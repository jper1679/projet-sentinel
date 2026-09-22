# ==============================================================================
# Projet Sentinel — Service Parsing XMind (.xmind)
# Supporte les formats JSON (XMind ZEN / 2020+) et XML (XMind 8)
# ==============================================================================

import io
import json
import uuid
import zipfile
import xml.etree.ElementTree as ET
from typing import Any


def _extract_notes(topic_json: dict[str, Any]) -> str | None:
    """Extrait la note / description textuelle d'un sujet XMind (format JSON)."""
    notes_obj = topic_json.get("notes")
    if not notes_obj or not isinstance(notes_obj, dict):
        return None
    
    # Text brut dans plain
    plain_content = notes_obj.get("plain", {}).get("content")
    if plain_content and isinstance(plain_content, str):
        return plain_content.strip()

    # Fallback HTML
    html_content = notes_obj.get("html", {}).get("content")
    if html_content and isinstance(html_content, str):
        # Suppression basique des balises HTML
        import re
        clean_text = re.sub(r'<[^>]+>', '', html_content)
        return clean_text.strip()

    return None


def _map_markers(markers: list[dict[str, Any]] | None) -> tuple[str, str]:
    """
    Mappe les marqueurs XMind (ex: priority-1, task-start, task-done)
    vers les valeurs Sentinel (Priorité, Statut).
    """
    priorite = "NORMALE"
    statut = "A_FAIRE"

    if not markers or not isinstance(markers, list):
        return priorite, statut

    for m in markers:
        if not isinstance(m, dict):
            continue
        marker_id = str(m.get("markerId") or m.get("id") or "").lower()

        # Marqueurs de Priorité
        if "priority-1" in marker_id or "prio-1" in marker_id:
            priorite = "CRITIQUE"
        elif "priority-2" in marker_id or "prio-2" in marker_id:
            priorite = "HAUTE"
        elif "priority-3" in marker_id or "prio-3" in marker_id:
            priorite = "NORMALE"
        elif "priority-4" in marker_id or "priority-5" in marker_id or "priority-6" in marker_id:
            priorite = "BASSE"

        # Marqueurs d'Avancement / Statut
        if "task-done" in marker_id or "symbol-done" in marker_id:
            statut = "TERMINE"
        elif "task-start" in marker_id or "task-half" in marker_id or "task-quarter" in marker_id or "task-3quarter" in marker_id:
            statut = "EN_COURS"
        elif "task-pause" in marker_id or "symbol-wrong" in marker_id or "flag-red" in marker_id:
            statut = "BLOQUE"
        elif "task-backlog" in marker_id:
            statut = "BACKLOG"

    return priorite, statut


def parse_xmind_bytes(file_bytes: bytes) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Parse le contenu binaire d'un fichier .xmind ou .json exporté de XMind.
    Retourne (nodes, links) au format attendu pour l'insertion Neo4j.
    """
    # 1. Tenter d'ouvrir comme archive ZIP (.xmind)
    content_json_raw = None
    content_xml_raw = None

    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
            namelist = z.namelist()
            if "content.json" in namelist:
                content_json_raw = z.read("content.json").decode("utf-8", errors="ignore")
            elif "content.xml" in namelist:
                content_xml_raw = z.read("content.xml").decode("utf-8", errors="ignore")
    except zipfile.BadZipFile:
        # Peut-être un fichier JSON brut exporté directement de XMind
        try:
            content_json_raw = file_bytes.decode("utf-8", errors="ignore")
        except Exception:
            raise ValueError("Le fichier fourni n'est pas une archive XMind valide ni un fichier JSON XMind.")

    nodes: list[dict[str, Any]] = []
    links: list[dict[str, Any]] = []

    # Map pour associer les IDs XMind d'origine aux nouveaux UUIDs Sentinel
    xmind_id_to_sentinel_id: dict[str, str] = {}

    # Compteurs pour disposition spatiale automatique sur le canevas
    y_counters: dict[int, float] = {}

    def get_next_y(level: int) -> float:
        current_y = y_counters.get(level, 0.0)
        y_counters[level] = current_y + 140.0
        return current_y

    # --------------------------------------------------------------------------
    # OPTION A : Parsing JSON (XMind ZEN / 2020+)
    # --------------------------------------------------------------------------
    if content_json_raw:
        try:
            sheets = json.loads(content_json_raw)
            if isinstance(sheets, dict):
                sheets = [sheets]
        except Exception as e:
            raise ValueError(f"Erreur de lecture du JSON XMind : {e}")

        for sheet in sheets:
            if not isinstance(sheet, dict):
                continue
            root_topic = sheet.get("rootTopic")
            if not root_topic or not isinstance(root_topic, dict):
                continue

            # Traitement récursif des sujets JSON
            def parse_json_topic(topic: dict[str, Any], parent_sentinel_id: str | None = None, level: int = 0):
                orig_id = str(topic.get("id") or uuid.uuid4())
                sentinel_id = str(uuid.uuid4())
                xmind_id_to_sentinel_id[orig_id] = sentinel_id

                titre = str(topic.get("title") or "Sujet sans titre").strip()
                description = _extract_notes(topic)

                # Extraction des marqueurs (priorités et états)
                markers = topic.get("markers")
                priorite, statut = _map_markers(markers)

                # Recherche d'enfants
                children_obj = topic.get("children", {})
                attached_children = []
                if isinstance(children_obj, dict):
                    attached_children = children_obj.get("attached", [])
                    if not isinstance(attached_children, list):
                        attached_children = []

                # Détermination du Type Sentinel
                if level == 0:
                    node_type = "PROJET"
                elif len(attached_children) > 0:
                    node_type = "COMPOSANT"
                else:
                    node_type = "TACHE"

                # Calcul des positions spatiales
                pos_x = level * 360.0
                pos_y = get_next_y(level)

                node_dict = {
                    "id": sentinel_id,
                    "titre": titre,
                    "description": description,
                    "type": node_type,
                    "statut": statut,
                    "priorite": priorite,
                    "temps_estime_h": None,
                    "cout_estime": None,
                    "pos_x": pos_x,
                    "pos_y": pos_y,
                }
                nodes.append(node_dict)

                # Si on a un parent, créer un lien CONTIENT_ETAPE
                if parent_sentinel_id:
                    link_dict = {
                        "id": str(uuid.uuid4()),
                        "source_id": parent_sentinel_id,
                        "target_id": sentinel_id,
                        "type": "CONTIENT_ETAPE",
                    }
                    links.append(link_dict)

                # Récursion sur les enfants
                for child in attached_children:
                    if isinstance(child, dict):
                        parse_json_topic(child, sentinel_id, level + 1)

            parse_json_topic(root_topic, None, 0)

            # Traitement des relations explicites de la feuille
            relationships = sheet.get("relationships", [])
            if isinstance(relationships, list):
                for rel in relationships:
                    if not isinstance(rel, dict):
                        continue
                    src_orig = str(rel.get("end1Id") or "")
                    tgt_orig = str(rel.get("end2Id") or "")
                    src_id = xmind_id_to_sentinel_id.get(src_orig)
                    tgt_id = xmind_id_to_sentinel_id.get(tgt_orig)
                    if src_id and tgt_id:
                        links.append({
                            "id": str(uuid.uuid4()),
                            "source_id": src_id,
                            "target_id": tgt_id,
                            "type": "LIE_A",
                        })

    # --------------------------------------------------------------------------
    # OPTION B : Parsing XML (XMind 8 / Légacy)
    # --------------------------------------------------------------------------
    elif content_xml_raw:
        try:
            root_elem = ET.fromstring(content_xml_raw)
        except Exception as e:
            raise ValueError(f"Erreur de lecture du XML XMind : {e}")

        # Espace de nommage éventuel
        ns = {'xmind': 'http://www.xmind.net/xmind/domain/1.0'}

        def parse_xml_topic(elem: ET.Element, parent_sentinel_id: str | None = None, level: int = 0):
            orig_id = elem.attrib.get("id") or str(uuid.uuid4())
            sentinel_id = str(uuid.uuid4())
            xmind_id_to_sentinel_id[orig_id] = sentinel_id

            # Titre
            title_elem = elem.find("xmind:title", ns) if elem.find("xmind:title", ns) is not None else elem.find("title")
            titre = title_elem.text.strip() if (title_elem is not None and title_elem.text) else "Sujet sans titre"

            # Recherche d'enfants
            children_elem = elem.find("xmind:children", ns) if elem.find("xmind:children", ns) is not None else elem.find("children")
            child_topics = []
            if children_elem is not None:
                for topics in children_elem:
                    for t in topics:
                        if t.tag.endswith("topic"):
                            child_topics.append(t)

            # Type
            if level == 0:
                node_type = "PROJET"
            elif len(child_topics) > 0:
                node_type = "COMPOSANT"
            else:
                node_type = "TACHE"

            pos_x = level * 360.0
            pos_y = get_next_y(level)

            node_dict = {
                "id": sentinel_id,
                "titre": titre,
                "description": None,
                "type": node_type,
                "statut": "A_FAIRE",
                "priorite": "NORMALE",
                "temps_estime_h": None,
                "cout_estime": None,
                "pos_x": pos_x,
                "pos_y": pos_y,
            }
            nodes.append(node_dict)

            if parent_sentinel_id:
                links.append({
                    "id": str(uuid.uuid4()),
                    "source_id": parent_sentinel_id,
                    "target_id": sentinel_id,
                    "type": "CONTIENT_ETAPE",
                })

            for child_t in child_topics:
                parse_xml_topic(child_t, sentinel_id, level + 1)

        # Chercher le topic racine
        root_topics = root_elem.findall(".//topic") or root_elem.findall(".//{http://www.xmind.net/xmind/domain/1.0}topic")
        if root_topics:
            parse_xml_topic(root_topics[0], None, 0)

    return nodes, links
