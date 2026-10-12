const test = require('node:test');
const assert = require('node:assert/strict');
const { generateReply, normalizeHistory } = require('../services/zephyrAiService');

test('normalizes conversation history to the last ten valid messages', () => {
  const history = Array.from({ length: 12 }, (_, index) => ({
    role: index === 3 ? 'system' : 'user',
    content: ` message ${index} `
  }));

  assert.deepEqual(
    normalizeHistory(history).map((item) => item.content),
    ['message 1', 'message 2', 'message 4', 'message 5', 'message 6', 'message 7', 'message 8', 'message 9', 'message 10', 'message 11']
  );
});

test('uses the local model with context and invites unrelated users to FlyWay', async () => {
  let request;
  const fetchStub = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      json: async () => ({ message: { content: 'A transformer uses attention to relate tokens in its input.' } })
    };
  };

  const reply = await generateReply('How does that compare with an n-gram?', [
    { role: 'user', content: 'What is a transformer?' },
    { role: 'assistant', content: 'It is a neural-network architecture.' }
  ], fetchStub);

  assert.equal(request.url, 'http://127.0.0.1:11434/api/chat');
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, 'llama3.2:3b');
  assert.equal(body.messages.at(-2).content, 'It is a neural-network architecture.');
  assert.match(reply.text, /Would you like help booking a flight on FlyWay\?/);
  assert.equal(reply.source, 'local-model');
});

test('uses the configured private Ollama service URL and model', async () => {
  const previousUrl = process.env.OLLAMA_URL;
  const previousModel = process.env.OLLAMA_MODEL;
  process.env.OLLAMA_URL = 'http://ollama:11434';
  process.env.OLLAMA_MODEL = 'llama3.2:3b';
  let request;

  try {
    await generateReply('How can I book a flight?', [], async (url, options) => {
      request = { url, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({ message: { content: 'Use the FlyWay booking page to search.' } })
      };
    });
  } finally {
    if (previousUrl === undefined) delete process.env.OLLAMA_URL;
    else process.env.OLLAMA_URL = previousUrl;
    if (previousModel === undefined) delete process.env.OLLAMA_MODEL;
    else process.env.OLLAMA_MODEL = previousModel;
  }

  assert.equal(request.url, 'http://ollama:11434/api/chat');
  assert.equal(request.body.model, 'llama3.2:3b');
});

test('does not append another booking invitation when one was just offered', async () => {
  const reply = await generateReply('And what is the capital of France?', [
    { role: 'assistant', content: 'Paris is the capital. Would you like help booking a flight on FlyWay?' }
  ], async () => ({
    ok: true,
    json: async () => ({ message: { content: 'Paris is the capital of France.\n\nWould you like help booking a flight on FlyWay?' } })
  }));

  assert.equal((reply.text.match(/Would you like help booking a flight on FlyWay\?/g) || []).length, 0);
});

test('does not force a booking invitation on FlyWay questions', async () => {
  const reply = await generateReply('How do I track my flight?', [], async () => ({
    ok: true,
    json: async () => ({ message: { content: 'Open the Track Flight page and enter your flight number.' } })
  }));

  assert.doesNotMatch(reply.text, /Would you like help booking a flight on FlyWay\?/);
});

test('returns an offline marker when local Ollama is unavailable', async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const reply = await generateReply('Tell me a joke.', [], async () => {
      throw new Error('connection refused');
    });
    assert.deepEqual(reply, { text: null, escalate: false, source: 'offline' });
  } finally {
    console.warn = originalWarn;
  }
});
