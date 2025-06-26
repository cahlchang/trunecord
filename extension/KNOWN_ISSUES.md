# Known Issues and Solutions

## 1. Multiple Start Requests (Double-click Prevention)

### Problem
When users rapidly click the "Start Streaming" button multiple times, it can cause:
- Multiple offscreen documents being created
- WebSocket connection conflicts
- Audio capture errors

### Solution Implemented
- Added `capturePromise` singleton pattern to prevent concurrent captures
- Added `isCreatingOffscreen` flag to prevent multiple offscreen document creation
- Proper cleanup with `finally()` blocks to reset state

### Code Example
```javascript
// Prevent multiple simultaneous captures
if (capturePromise) {
  console.log('Capture already in progress, waiting for completion');
  return capturePromise;
}
```

## 2. Offscreen Document Lifecycle

### Problem
Chrome's offscreen API has strict requirements:
- Only one offscreen document can exist at a time
- Must be closed before creating a new one
- Can timeout if not responding

### Solution Implemented
- Always check and close existing document before creating new one
- Add delays between close and create operations
- Proper error handling for creation failures

## 3. WebSocket Connection State

### Problem
WebSocket connections can be in various states causing:
- Messages sent to closed connections
- Multiple connection attempts
- Lost messages during reconnection

### Solution Implemented
- Check WebSocket readyState before sending
- Single connection management
- Automatic reconnection on disconnect

## 4. Audio Stream State Synchronization

### Problem
Streaming state can become out of sync between:
- Chrome extension popup
- YouTube Music tab
- Local Go client
- Discord connection

### Solution Implemented
- Multiple state notification channels
- Silence detection for pause/resume
- Timeout for no audio data
- Regular status polling

## 5. Tab Close During Streaming

### Problem
If YouTube Music tab is closed while streaming:
- Offscreen document may remain active
- WebSocket may stay connected
- Discord bot continues in voice channel

### Solution Implemented
- Tab removal listener
- Automatic cleanup when no YouTube Music tabs exist
- Proper disconnection sequence

## Testing

Run tests to verify fixes:
```bash
npm test
```

Integration tests cover:
- Double-click prevention
- WebSocket management
- Offscreen document lifecycle
- Error recovery
- Message passing