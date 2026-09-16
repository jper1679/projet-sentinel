# ==============================================================================
# Projet Sentinel — Service GitHub Agent (Interface PyGithub & Outils Gemini)
# ==============================================================================

import os
import structlog
from typing import Optional, List
from github import Github, GithubException
from app.config import get_settings

logger = structlog.get_logger()


class GitHubService:
    """Interface avec l'API GitHub via PyGithub pour l'agent de maintenance."""

    def __init__(self, token: Optional[str] = None, repo_name: Optional[str] = None):
        settings = get_settings()
        self.token = token or settings.github_token or os.environ.get("GITHUB_TOKEN", "")
        self.repo_name = repo_name or settings.github_repo or os.environ.get("GITHUB_REPO", "")

    def _get_repo(self):
        if not self.token or not self.token.strip():
            raise ValueError("Le token GitHub (GITHUB_TOKEN) n'est pas configuré.")
        if not self.repo_name or not self.repo_name.strip():
            raise ValueError("Le dépôt GitHub (GITHUB_REPO) n'est pas configuré.")
        
        g = Github(self.token)
        return g.get_repo(self.repo_name)

    def read_repo_file(self, path: str) -> str:
        """Fetch content of a file (markdown, code) from the target repository.
        
        Args:
            path: Relative filepath in the repository (e.g., 'README.md', 'docs/architecture.md').
        """
        try:
            repo = self._get_repo()
            content_file = repo.get_contents(path)
            if isinstance(content_file, list):
                # Directory listed instead of single file
                files = [f.path for f in content_file]
                return f"Le chemin est un dossier contenant : {', '.join(files)}"
            return content_file.decoded_content.decode("utf-8")
        except GithubException as e:
            logger.error("Error reading GitHub file", path=path, status=e.status, message=e.data)
            return f"Erreur lors de la lecture du fichier '{path}': {e.data.get('message', str(e))}"
        except Exception as e:
            logger.error("Unexpected error reading GitHub file", path=path, error=str(e))
            return f"Erreur lors de la lecture du fichier '{path}': {str(e)}"

    def search_repo(self, query: str) -> List[str]:
        """Search relevant files in the repository codebase.
        
        Args:
            query: Search string or keywords to find in code/docs.
        """
        try:
            if not self.token or not self.repo_name:
                raise ValueError("Credentials GitHub manquants pour la recherche.")
            g = Github(self.token)
            search_results = g.search_code(f"repo:{self.repo_name} {query}")
            file_paths = []
            for item in search_results[:15]:
                file_paths.append(item.path)
            return file_paths if file_paths else [f"Aucun fichier trouvé pour la recherche '{query}'."]
        except Exception as e:
            logger.error("Error searching GitHub repository", query=query, error=str(e))
            return [f"Erreur de recherche : {str(e)}"]

    def propose_doc_update(
        self,
        file_path: str,
        new_content: str,
        commit_message: str,
        branch_name: str,
        pr_title: str,
        pr_description: str,
    ) -> str:
        """Creates a new branch from main, commits modified content, and opens a Pull Request.
        
        Args:
            file_path: Target file path to update or create.
            new_content: Updated or new full content for the file.
            commit_message: Message for the Git commit.
            branch_name: Unique branch name for the PR (must NOT be 'main' or 'master').
            pr_title: Title of the Pull Request.
            pr_description: Clear description and rationale for the PR body.
        """
        # Safety rule: Never push directly to main or master
        clean_branch = branch_name.strip().lower()
        if clean_branch in ["main", "master"]:
            return "RÈGLE DE SÉCURITÉ VIOLÉE : Il est strictement interdit de pousser directement sur la branche principale ('main' ou 'master'). Veuillez utiliser un nom de branche dédié (ex: 'docs/update-readme')."

        try:
            repo = self._get_repo()
            default_branch = repo.default_branch

            # 1. Obtenir le SHA du dernier commit de la branche par défaut
            main_ref = repo.get_git_ref(f"heads/{default_branch}")
            main_sha = main_ref.object.sha

            # 2. Créer la nouvelle branche
            target_ref = f"refs/heads/{branch_name}"
            try:
                repo.create_git_ref(ref=target_ref, sha=main_sha)
                logger.info("Created new Git branch", branch=branch_name, base=default_branch)
            except GithubException as ge:
                if ge.status == 422:
                    logger.info("Branch already exists, using existing branch", branch=branch_name)
                else:
                    raise ge

            # 3. Mettre à jour ou créer le fichier dans la branche
            try:
                existing_file = repo.get_contents(file_path, ref=branch_name)
                repo.update_file(
                    path=file_path,
                    message=commit_message,
                    content=new_content,
                    sha=existing_file.sha,
                    branch=branch_name,
                )
                logger.info("Updated existing file in branch", path=file_path, branch=branch_name)
            except GithubException:
                repo.create_file(
                    path=file_path,
                    message=commit_message,
                    content=new_content,
                    branch=branch_name,
                )
                logger.info("Created new file in branch", path=file_path, branch=branch_name)

            # 4. Ouvrir la Pull Request
            pr = repo.create_pull(
                title=pr_title,
                body=pr_description,
                head=branch_name,
                base=default_branch,
            )
            logger.info("Successfully created Pull Request", pr_url=pr.html_url, pr_number=pr.number)
            return f"PULL REQUEST CRÉÉE AVEC SUCCÈS : {pr.html_url} (PR #{pr.number})"

        except GithubException as e:
            error_msg = f"Erreur GitHub API ({e.status}): {e.data.get('message', str(e))}"
            logger.error("Failed to propose doc update via PR", error=error_msg)
            return error_msg
        except Exception as e:
            error_msg = f"Erreur inattendue lors de la création de la PR : {str(e)}"
            logger.error("Unexpected error in propose_doc_update", error=error_msg)
            return error_msg


# Standalone helper tool wrappers for default client instance
default_github_service = GitHubService()

def read_repo_file(path: str) -> str:
    """Fetches content of files (markdown, code) from the targeted repo."""
    return default_github_service.read_repo_file(path)

def search_repo(query: str) -> list[str]:
    """Searches relevant files in the codebase."""
    return default_github_service.search_repo(query)

def propose_doc_update(
    file_path: str,
    new_content: str,
    commit_message: str,
    branch_name: str,
    pr_title: str,
    pr_description: str,
) -> str:
    """Creates a new branch from main, commits modified content, and opens a Pull Request."""
    return default_github_service.propose_doc_update(
        file_path=file_path,
        new_content=new_content,
        commit_message=commit_message,
        branch_name=branch_name,
        pr_title=pr_title,
        pr_description=pr_description,
    )
