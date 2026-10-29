"""TradeX AI - Document Storage Backend Interface and Security Validation (Prompt 18)
Provides abstract StorageBackend with LocalStorageBackend implementation
and strict magic byte validation to reject extension spoofing (e.g. .exe renamed to .pdf).
"""
import abc
import os
import uuid
from typing import Optional, Tuple

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".docx", ".xlsx"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
}


def get_max_upload_size() -> int:
    try:
        mb = int(os.getenv("MAX_UPLOAD_SIZE_MB", "10"))
    except ValueError:
        mb = 10
    return mb * 1024 * 1024


def validate_file_security(content: bytes, filename: str, declared_mime: str) -> Tuple[bool, str]:
    """
    Validates file size, file extension, and inspects magic byte headers
    to prevent file extension spoofing (e.g. windows PE executables renamed to .pdf).
    """
    max_bytes = get_max_upload_size()
    max_mb = max_bytes // (1024 * 1024)

    if len(content) > max_bytes:
        return False, f"File exceeds maximum allowed size of {max_mb} MB"

    if len(content) < 4:
        return False, "File is empty or corrupted"

    # Sanitize and extract extension
    clean_name = os.path.basename(filename.replace("\\", "/"))
    ext = os.path.splitext(clean_name.lower())[1]
    if ext not in ALLOWED_EXTENSIONS:
        return False, f"File extension '{ext}' is not permitted. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"

    # Check for executable headers:
    # MZ (DOS/Windows PE executables), \x7fELF (Linux ELF binaries), Mach-O binaries (\xca\xfe\xba\xbe, etc.)
    executable_signatures = [
        b"MZ",
        b"\x7fELF",
        b"\xca\xfe\xba\xbe",
        b"\xfe\xed\xfa\xce",
        b"\xfe\xed\xfa\xcf",
        b"\xcf\xfa\xed\xfe",
    ]
    for sig in executable_signatures:
        if content.startswith(sig):
            return False, "Malicious or executable file header detected. File rejected."

    # Validate Magic signatures based on claimed extension
    if ext == ".pdf":
        if not (content.startswith(b"%PDF-") or b"%PDF-" in content[:1024]):
            return False, "Invalid PDF file: Missing %PDF- file header signature"
    elif ext == ".png":
        if not content.startswith(b"\x89PNG\r\n\x1a\n"):
            return False, "Invalid PNG file: Missing PNG header signature"
    elif ext in [".jpg", ".jpeg"]:
        if not content.startswith(b"\xff\xd8\xff"):
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
    def __init__(self, base_dir: Optional[str] = None):
        if not base_dir:
            env_path = os.getenv("LOCAL_STORAGE_PATH") or os.getenv("STORAGE_DIR")
            if env_path:
                base_dir = os.path.join(env_path, "documents") if not env_path.endswith("documents") else env_path
            else:
                base_dir = "storage/documents"

        self.base_dir = os.path.abspath(base_dir)
        try:
            os.makedirs(self.base_dir, exist_ok=True)
        except OSError:
            # Fallback to local cwd storage/documents or /tmp if system permissions prevent creation
            fallback = os.path.abspath(os.path.join(os.getcwd(), "storage", "documents"))
            try:
                os.makedirs(fallback, exist_ok=True)
                self.base_dir = fallback
            except OSError:
                pass

    async def save(self, content: bytes, original_filename: str) -> Tuple[str, str]:
        try:
            os.makedirs(self.base_dir, exist_ok=True)
        except OSError:
            pass

        clean_name = os.path.basename(original_filename.replace("\\", "/"))
        ext = os.path.splitext(clean_name.lower())[1]
        if not ext:
            ext = ".pdf"

        # Block path traversal: generate random server-side filename and ensure within base_dir
        unique_name = f"{uuid.uuid4().hex}{ext}"
        target_path = os.path.abspath(os.path.join(self.base_dir, unique_name))

        # Check path traversal
        if not target_path.startswith(self.base_dir):
            raise ValueError("Directory traversal attempt detected in storage path")

        # Never overwrite existing files
        while os.path.exists(target_path):
            unique_name = f"{uuid.uuid4().hex}{ext}"
            target_path = os.path.abspath(os.path.join(self.base_dir, unique_name))

        with open(target_path, "wb") as f:
            f.write(content)

        return target_path, unique_name

    async def get(self, storage_path: str) -> bytes:
        # Check primary absolute path
        if os.path.exists(storage_path):
            with open(storage_path, "rb") as f:
                return f.read()

        # Check in self.base_dir with basename
        fname = os.path.basename(storage_path)
        alt_path = os.path.join(self.base_dir, fname)
        if os.path.exists(alt_path):
            with open(alt_path, "rb") as f:
                return f.read()

        raise FileNotFoundError(f"Stored document not found at {storage_path}")

    async def delete(self, storage_path: str) -> bool:
        deleted = False
        if os.path.exists(storage_path):
            os.remove(storage_path)
            deleted = True

        fname = os.path.basename(storage_path)
        alt_path = os.path.join(self.base_dir, fname)
        if os.path.exists(alt_path):
            os.remove(alt_path)
            deleted = True

        return deleted


class S3StorageBackend(StorageBackend):
    """S3-compatible object storage placeholder for cloud multi-region deployments."""
    def __init__(self, bucket_name: str = "tradex-documents"):
        self.bucket_name = bucket_name

    async def save(self, content: bytes, original_filename: str) -> Tuple[str, str]:
        clean_name = os.path.basename(original_filename.replace("\\", "/"))
        ext = os.path.splitext(clean_name.lower())[1]
        unique_name = f"{uuid.uuid4().hex}{ext}"
        s3_uri = f"s3://{self.bucket_name}/{unique_name}"
        # For now fallback to local
        local = LocalStorageBackend()
        path, _ = await local.save(content, original_filename)
        return path, unique_name

    async def get(self, storage_path: str) -> bytes:
        local = LocalStorageBackend()
        return await local.get(storage_path)

    async def delete(self, storage_path: str) -> bool:
        local = LocalStorageBackend()
        return await local.delete(storage_path)


def get_storage_backend() -> StorageBackend:
    """Factory returning configured storage backend (local volume now, S3 later)."""
    storage_type = os.getenv("STORAGE_BACKEND", "local").lower()
    if storage_type == "s3":
        return S3StorageBackend()
    return LocalStorageBackend()