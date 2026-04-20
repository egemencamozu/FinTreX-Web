import asyncio
from typing import Dict
import logging

logger = logging.getLogger(__name__)

class ConversationLockManager:
    """
    Conversation-based asyncio lock management. 
    Prevents concurrent requests for the same conversation_id from 
    causing state conflicts in the LangGraph engine.
    
    Note: This is an in-memory implementation for single-worker usage.
    For multi-worker production scenarios, a distributed lock (e.g., Redis) is required.
    """

    def __init__(self):
        self._locks: Dict[str, asyncio.Lock] = {}
        self._meta_lock = asyncio.Lock()  # Protects access to the _locks dictionary

    async def acquire(self, conversation_id: str) -> bool:
        """
        Attempts to acquire a lock for the given conversation_id.
        If the lock is already held, it returns False immediately (non-blocking).
        """
        async with self._meta_lock:
            if conversation_id not in self._locks:
                self._locks[conversation_id] = asyncio.Lock()
            
            lock = self._locks[conversation_id]
            
        # Try to acquire the specific conversation lock
        # We use locked() check to avoid queuing requests (fail fast)
        if lock.locked():
            logger.warning(f"Concurrent request blocked for conversation_id: {conversation_id}")
            return False
            
        await lock.acquire()
        return True

    async def release(self, conversation_id: str) -> None:
        """
        Releases the lock for the given conversation_id.
        """
        async with self._meta_lock:
            lock = self._locks.get(conversation_id)
            if lock and lock.locked():
                lock.release()
            
            # Optional: Clean up old locks if needed, but keeping them is fine for small scale
            # To prevent memory leak in very long running process with millions of convs,
            # we could implement a cleanup threshold.

# Single instance to be used across the application
conversation_lock_manager = ConversationLockManager()
