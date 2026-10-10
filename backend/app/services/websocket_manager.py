"""
TradeX AI - Real-time WebSocket Connection Manager
Maintains in-memory user sessions and broadcasts real-time chat messages,
counter-offers, notifications, and shipment milestones.
"""
import json
import logging
from typing import Dict, List, Optional
from uuid import UUID
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        # Map user_id -> list of active WebSocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"WebSocket connected for user: {user_id}. Active sessions: {len(self.active_connections[user_id])}")

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"WebSocket disconnected for user: {user_id}")

    async def send_personal_message(self, message: dict, user_id: str) -> None:
        """Send message to all open tabs/devices for a specific user."""
        if user_id in self.active_connections:
            dead_connections = []
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_text(json.dumps(message))
                except Exception as e:
                    logger.warning(f"Error sending message to user {user_id}: {e}")
                    dead_connections.append(ws)
            for dead in dead_connections:
                self.disconnect(dead, user_id)

    async def broadcast_to_users(self, message: dict, user_ids: List[str]) -> None:
        """Broadcast message to specified list of user IDs."""
        for uid in user_ids:
            await self.send_personal_message(message, str(uid))


# Global singleton instance
ws_manager = ConnectionManager()
