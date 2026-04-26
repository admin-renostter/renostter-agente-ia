import { getRedis } from "./redis";
import { flushConversation } from "./flush";

export interface ChannelMessage {
  providerMsgId?: string;
  contactId: string; // externalId do canal (ex: "5511...@c.us")
  text: string;
  channel: string;
  conversationId: string;
}

export async function enqueueDebounce(
  msg: ChannelMessage,
  debounceMs: number
): Promise<void> {
  let redis;
  try {
    redis = getRedis();
  } catch (err) {
    console.error(JSON.stringify({ event: "debounce.redis_init_failed", err: String(err) }));
    await flushConversation(msg.conversationId, [msg]);
    return;
  }

  const key = `debounce:${msg.channel}:${msg.contactId}`;
  const queueKey = `dqueue:${msg.channel}:${msg.contactId}`;
  const lockKey = `dlock:${msg.channel}:${msg.contactId}`;
  const lockTtlMs = debounceMs * 4; // §0.9.23

  try {
    const pipeline = redis.multi();
    pipeline.rpush(queueKey, JSON.stringify(msg));
    pipeline.pexpire(queueKey, lockTtlMs);
    await pipeline.exec();

    const token = `${Date.now()}-${Math.random()}`;
    const set = await redis.set(key, token, "PX", debounceMs, "NX");

    if (set === "OK") {
      setTimeout(async () => {
        const current = await redis.get(key);
        if (current === null) {
          console.error(JSON.stringify({ event: "debounce.lock_expired", key }));
          return;
        }
        if (current !== token) {
          console.log(JSON.stringify({ event: "debounce.superseded", key }));
          return;
        }
        await redis.del(key);
        const rawMsgs = await redis.lrange(queueKey, 0, -1);
        await redis.del(queueKey);
        const msgs: ChannelMessage[] = rawMsgs.map((r) => JSON.parse(r));
        await flushConversation(msg.conversationId, msgs);
      }, debounceMs + 50);
    } else {
      // Reset lock TTL on new message
      await redis.pexpire(key, debounceMs);
    }
  } catch (err) {
    console.error(JSON.stringify({ event: "debounce.error", err: String(err) }));
    await flushConversation(msg.conversationId, [msg]);
  }
}
