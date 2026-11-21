# Device trust

LocalLink pairing identifies the peer by its TLS certificate fingerprint, not its
display name or IP address. Favorites never grant receive permission.

- A blue shield means this computer has paired with the device. Its tooltip
  distinguishes automatic receive from asking on each transfer.
- Click the shield or Device details to control automatic receiving or remove
  trust. Permissions govern incoming content on this computer only.
- Settings → General → Receiving and saving → Manage trusted devices also works
  for previously paired devices that are offline.
- Pairing defaults to asking each time. An authenticated paired sender's receive
  prompt offers an unchecked option to remember automatic receive permission.
  Rejecting a transfer does not grant permission. Unknown senders have no such option.
- Removing trust clears local automatic receive authorization. It does not change
  the other computer's permissions or cancel transfers already accepted.
- This pairing extension requires LocalLink peers; stock LocalSend file transfer
  compatibility does not imply support for LocalLink trust management.

Validation: isolated Electron UI tests cover favorites, persisted trust, shield
rendering, receive toggles, offline revocation, all three languages, and settings.
A second test uses an independent HTTPS client to pair with the real desktop
receiver, remember permission, send an original file into an isolated destination
without another prompt, and restore prompts after revocation. Existing protocol
tests cover certificate identity spoof rejection. Physical two-PC testing remains
separate from these local integration tests.
