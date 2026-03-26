CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  key_p256dh TEXT NOT NULL,
  key_auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
