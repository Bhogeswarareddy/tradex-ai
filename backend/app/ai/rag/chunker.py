import os
import re
from typing import Any, Dict, List


class MarkdownChunk:
    def __init__(self, guide_slug: str, title: str, section_header: str, content: str, metadata: Dict[str, Any]):
        self.guide_slug = guide_slug
        self.title = title
        self.section_header = section_header
        self.content = content.strip()
        self.metadata = metadata

    def to_dict(self) -> Dict[str, Any]:
        return {
            "guide_slug": self.guide_slug,
            "title": self.title,
            "section_header": self.section_header,
            "content": self.content,
            "metadata": self.metadata,
        }


def chunk_markdown_file(file_path: str, max_chunk_chars: int = 1500) -> List[MarkdownChunk]:
    """
    Parses a Markdown file and produces semantically bounded chunks
    grouped by heading hierarchy and paragraph boundaries.
    """
    guide_slug = os.path.splitext(os.path.basename(file_path))[0]
    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()

    # Extract main title
    title_match = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
    main_title = title_match.group(1).strip() if title_match else guide_slug.replace("_", " ").title()

    # Split by level 2 headings (## )
    sections = re.split(r"\n(?=##\s+)", text)
    chunks: List[MarkdownChunk] = []

    for sec in sections:
        sec = sec.strip()
        if not sec:
            continue

        header_match = re.match(r"^##\s+(.+)$", sec, re.MULTILINE)
        section_name = header_match.group(1).strip() if header_match else "Overview"

        if len(sec) <= max_chunk_chars:
            chunks.append(
                MarkdownChunk(
                    guide_slug=guide_slug,
                    title=main_title,
                    section_header=section_name,
                    content=sec,
                    metadata={"source_file": os.path.basename(file_path), "section": section_name},
                )
            )
        else:
            # Split by subheadings (### ) or double newlines
            sub_parts = re.split(r"\n(?=###\s+)|\n\n+", sec)
            current_buffer = []
            current_len = 0

            for part in sub_parts:
                part = part.strip()
                if not part:
                    continue

                if current_len + len(part) > max_chunk_chars and current_buffer:
                    chunk_text = f"## {section_name}\n" + "\n\n".join(current_buffer)
                    chunks.append(
                        MarkdownChunk(
                            guide_slug=guide_slug,
                            title=main_title,
                            section_header=section_name,
                            content=chunk_text,
                            metadata={"source_file": os.path.basename(file_path), "section": section_name},
                        )
                    )
                    current_buffer = [part]
                    current_len = len(part)
                else:
                    current_buffer.append(part)
                    current_len += len(part)

            if current_buffer:
                chunk_text = f"## {section_name}\n" + "\n\n".join(current_buffer)
                chunks.append(
                    MarkdownChunk(
                        guide_slug=guide_slug,
                        title=main_title,
                        section_header=section_name,
                        content=chunk_text,
                        metadata={"source_file": os.path.basename(file_path), "section": section_name},
                    )
                )

    return chunks
