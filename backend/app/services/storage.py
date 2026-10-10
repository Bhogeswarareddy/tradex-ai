"""TradeX AI - Document Storage Backend Interface and Security Validation (Prompt 18)
Provides abstract StorageBackend with LocalStorageBackend implementation
and strict magic byte validation to reject extension spoofing (e.g. .exe renamed to .pdf).
"""
import abc
import os
import uuid
from typing import Tuple

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".docx", ".xlsx"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def validate_file_security(content: bytes, filename: str, declared_mime: str) -> Tuple[bool, str]:
    """
    Validates file size, file extension, and inspects magic byte headers
    to prevent file extension spoofing (e.g. windows PE executables renamed to .pdf).
    """
    if len(content) > MAX_FILE_SIZE:
        return False, "File exceeds maximum allowed size of 10 MB"

    if len(content) < 4:
        return False, "File is empty or corrupted"

    ext = os.path.splitext(filename.lower())[1]
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"File extension '{ext}' is not permitted. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"

    # Check for executable headers (MZ for DOS/Windows PE executables, \x7fELF for Linux)
    if content.startswith(b"MZ") or content.startswith(b"\x7fELF"):
        return False, "Malicious or executable file header detected. File rejected."

    # Validate Magic signatures based on claimed extension
    if ext == ".pdf":
        if not content.startswith(b"%PDF-"):
            return False, "Invalid PDF file: Missing %PDF- file header signature"
    elif ext == ".png":
        if not content.startswith(b"\x89PNG\r\n\x1a\n"):
            return False, "Invalid PNG file: Missing PNG header signature"
    elif ext in [".jpg", ".jpeg"]:
        if not (content.startswith(b"\xff\xd8\xff")):
            return False, "Invalid JPEG file: Missing JPEG header signature"
    elif ext in [".docx", ".xlsx"]:
        # ZIP magic header for Office Open XML files: PK\x03\x04
        if not content.startswith(b"PK\x03\x04"):
            return False, f"Invalid Office document '{filename}': Missing PK zip container header"

    return True, "Valid"


class StorageBackend(abc.ABC):
    @abc.abstractmethod
    async def save(self, content: bytes, original_filename: str) -> Tuple[str, str]:
        """Saves file bytes and returns (storage_path, unique_stored_filename)"""
        pass

    @abc.abstractmethod
    async def get(self, storage_path: str) -> bytes:
        """Retrieves raw file bytes from storage"""
        pass

    @abc.abstractmethod
    async def delete(self, storage_path: str) -> bool:
        """Deletes file from storage"""
        pass


class LocalStorageBackend(StorageBackend):
    def __init__(self, base_dir: str = "storage/documents"):
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)

    async def save(self, content: bytes, original_filename: str) -> Tuple[str, str]:
        ext = os.path.splitext(original_filename.lower())[1]
        unique_name = f"{uuid.uuid4().hex}{ext}"
        target_path = os.path.join(self.base_dir, unique_name)

        with open(target_path, "wb") as f:
            f.write(content)

        return target_path, unique_name

    async def get(self, storage_path: str) -> bytes:
        if not os.path.exists(storage_path):
            raise FileNotFoundError(f"Stored document not found at {storage_path}")
        with open(storage_path, "rb") as f:
            return f.read()

    async def delete(self, storage_path: str) -> bool:
        if os.path.exists(storage_path):
            os.remove(storage_path)
            return True
        return False


def get_storage_backend() -> StorageBackend:
    """Factory returning configured storage backend (local volume or future S3)"""
    return LocalStorageBackend()