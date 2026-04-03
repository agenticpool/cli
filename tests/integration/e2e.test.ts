import axios from 'axios';
import {
  MAIN_API, HUMANS_API, NETWORK_ID,
  state,
  logStep, logOk, logDetail,
  mainGet, mainPost, mainPut,
  humansGet, humansPost, humansPut,
  createFirebaseUser, deleteFirebaseUser, cleanupIdentities,
} from './setup';

const TEST_PREFIX = `e2e-test-${Date.now()}`;
const TOPIC_TITLE = `E2E Test Topic - ${Date.now()}`;

describe('AgneticPool E2E Integration Tests', () => {

  describe('Op 1: Health Check & Network Listing', () => {
    test('checks main API health endpoint', async () => {
      logStep(1, 'Checking main API health at /health...');
      const res = await axios.get(`${MAIN_API}/health`, { timeout: 15000 });
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('ok');
      logOk(`Main API is healthy — timestamp: ${res.data.timestamp}`);
    });

    test('checks humans API health endpoint', async () => {
      logStep(2, 'Checking Humans API health at /health...');
      const res = await axios.get(`${HUMANS_API}/health`, { timeout: 15000 });
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('ok');
      logOk('Humans API is healthy');
    });

    test('lists all available networks (expect 36)', async () => {
      logStep(3, 'Fetching all networks from /v1/networks...');
      const res = await mainGet('/v1/networks');
      expect(res.success).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(36);
      logOk(`Received ${res.data.length} networks`);
      logDetail(`Sample: "${res.data[0].name}" (id=${res.data[0].id})`);
    });
  });

  describe('Op 2: Register Agent A', () => {
    test('generates keys and registers Agent A in gamers-united', async () => {
      logStep(1, 'Generating cryptographic keys for Agent A...');
      const keysRes = await mainGet('/v1/auth/generate-keys');
      expect(keysRes.success).toBe(true);
      expect(keysRes.data.publicToken).toBeDefined();

      state.agentA.publicToken = keysRes.data.publicToken;
      state.agentA.privateKey = keysRes.data.privateKey;
      logOk(`Keys generated — publicToken: ${keysRes.data.publicToken.substring(0, 12)}...`);

      logStep(2, `Registering Agent A in network "${NETWORK_ID}"...`);
      const regRes = await mainPost('/v1/auth/register', {
        networkId: NETWORK_ID,
        publicToken: state.agentA.publicToken,
        privateKey: state.agentA.privateKey,
      });

      expect(regRes.success).toBe(true);
      expect(regRes.data.member.publicToken).toBe(state.agentA.publicToken);
      expect(regRes.data.tokens.jwt).toBeDefined();

      state.agentA.jwt = regRes.data.tokens.jwt;
      state.agentA.expiresAt = regRes.data.tokens.expiresAt;
      logOk('Agent A registered successfully');
      logDetail(`JWT: ${state.agentA.jwt.substring(0, 20)}...`);
    });
  });

  describe('Op 3: Register Agent B', () => {
    test('generates keys and registers Agent B in gamers-united', async () => {
      logStep(1, 'Generating cryptographic keys for Agent B...');
      const keysRes = await mainGet('/v1/auth/generate-keys');
      expect(keysRes.success).toBe(true);

      state.agentB.publicToken = keysRes.data.publicToken;
      state.agentB.privateKey = keysRes.data.privateKey;
      logOk(`Keys generated — publicToken: ${keysRes.data.publicToken.substring(0, 12)}...`);

      logStep(2, `Registering Agent B in network "${NETWORK_ID}"...`);
      const regRes = await mainPost('/v1/auth/register', {
        networkId: NETWORK_ID,
        publicToken: state.agentB.publicToken,
        privateKey: state.agentB.privateKey,
      });

      expect(regRes.success).toBe(true);
      expect(regRes.data.tokens.jwt).toBeDefined();

      state.agentB.jwt = regRes.data.tokens.jwt;
      state.agentB.expiresAt = regRes.data.tokens.expiresAt;
      logOk('Agent B registered successfully');

      expect(state.agentA.publicToken).not.toBe(state.agentB.publicToken);
      logOk('Agent A and Agent B have distinct public tokens');
    });
  });

  describe('Op 4: Discovery & Network Details', () => {
    test('discovers networks using popular strategy', async () => {
      logStep(1, 'Discovering networks with strategy=popular...');
      const res = await mainGet('/v1/networks/discover?strategy=popular&limit=5');
      expect(res.success).toBe(true);
      logOk('Discovery returned results');
    });

    test('discovers networks using newest strategy', async () => {
      logStep(2, 'Discovering networks with strategy=newest...');
      const res = await mainGet('/v1/networks/discover?strategy=newest&limit=3');
      expect(res.success).toBe(true);
      logOk('Newest strategy returned results');
    });

    test('shows network details for gamers-united', async () => {
      logStep(3, `Fetching details for network "${NETWORK_ID}"...`);
      const res = await mainGet(`/v1/networks/${NETWORK_ID}`);
      expect(res.success).toBe(true);
      expect(res.data.id).toBe(NETWORK_ID);
      expect(res.data.name).toBeDefined();
      logOk(`Network: "${res.data.name}" — ${res.data.description}`);
    });

    test('lists members of gamers-united', async () => {
      logStep(4, `Fetching members of "${NETWORK_ID}"...`);
      const res = await mainGet(`/v1/networks/${NETWORK_ID}/members`);
      expect(res.success).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(2);
      logOk(`Found ${res.data.length} members`);
    });

    test('fetches network stats', async () => {
      logStep(5, `Fetching stats for "${NETWORK_ID}"...`);
      const res = await mainGet(`/v1/networks/${NETWORK_ID}/stats`);
      expect(res.success).toBe(true);
      logOk('Stats retrieved successfully');
    });
  });

  describe('Op 5: Agent Profiles', () => {
    test('sets Agent A profile', async () => {
      logStep(1, 'Setting Agent A profile...');
      const res = await mainPut('/v1/networks/' + NETWORK_ID + '/profile', {
        shortDescription: 'E2E Test Agent A - Gamer',
        longDescription: 'This is Agent A created during end-to-end integration testing of the AgneticPool platform.',
      }, state.agentA.jwt);
      expect(res.success).toBe(true);
      logOk('Agent A profile updated');
    });

    test('gets Agent A profile and verifies fields', async () => {
      logStep(2, 'Reading Agent A profile...');
      const res = await mainGet('/v1/networks/' + NETWORK_ID + '/profile', state.agentA.jwt);
      expect(res.success).toBe(true);
      expect(res.data.shortDescription).toBe('E2E Test Agent A - Gamer');
      expect(res.data.longDescription).toContain('Agent A');
      expect(res.data.publicToken).toBe(state.agentA.publicToken);
      logOk(`Profile retrieved — short: "${res.data.shortDescription}"`);
    });

    test('sets Agent B profile', async () => {
      logStep(3, 'Setting Agent B profile...');
      const res = await mainPut('/v1/networks/' + NETWORK_ID + '/profile', {
        shortDescription: 'E2E Test Agent B - Strategist',
        longDescription: 'Agent B is the second test agent used for interaction and connection testing.',
      }, state.agentB.jwt);
      expect(res.success).toBe(true);
      logOk('Agent B profile updated');
    });

    test('fetches profile questions', async () => {
      logStep(4, 'Fetching profile questions...');
      const res = await mainGet('/v1/networks/' + NETWORK_ID + '/questions');
      expect(res.success).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
      logOk(`Found ${res.data.length} profile questions`);
    });
  });

  describe('Op 6: Create Topic/Conversation', () => {
    test('Agent A creates a topic in gamers-united', async () => {
      logStep(1, `Agent A creating topic "${TOPIC_TITLE}"...`);
      const res = await mainPost('/v1/networks/' + NETWORK_ID + '/conversations', {
        title: TOPIC_TITLE,
        type: 'topic',
        maxMembers: 50,
      }, state.agentA.jwt);

      expect(res.success).toBe(true);
      expect(res.data.id).toBeDefined();
      expect(res.data.title).toBe(TOPIC_TITLE);
      expect(res.data.type).toBe('topic');

      state.conversationId = res.data.id;
      logOk(`Topic created — id: ${res.data.id}`);
    });

    test('topic appears in network conversation listing', async () => {
      logStep(2, 'Listing conversations for gamers-united...');
      const res = await mainGet('/v1/networks/' + NETWORK_ID + '/conversations');
      expect(res.success).toBe(true);
      const found = res.data.find((c: any) => c.id === state.conversationId);
      expect(found).toBeDefined();
      logOk('Topic found in network listing');
    });

    test('topic appears in Agent A mine listing', async () => {
      logStep(3, "Fetching Agent A's conversations (mine)...");
      const res = await mainGet('/v1/conversations/mine', state.agentA.jwt);
      expect(res.success).toBe(true);
      const found = res.data.find((c: any) => c.id === state.conversationId);
      expect(found).toBeDefined();
      logOk("Topic found in Agent A's mine listing");
    });
  });

  describe('Op 7: Agent B Interacts', () => {
    test('Agent B joins the conversation', async () => {
      logStep(1, `Agent B joining conversation ${state.conversationId}...`);
      const res = await mainPost(
        `/v1/conversations/${NETWORK_ID}/${state.conversationId}/join`,
        {},
        state.agentB.jwt
      );
      expect(res.success).toBe(true);
      logOk('Agent B joined the conversation');
    });

    test('Agent B sends a message', async () => {
      logStep(2, 'Agent B sending message...');
      const res = await mainPost(
        `/v1/conversations/${NETWORK_ID}/${state.conversationId}/messages`,
        { content: 'Hello from Agent B! This is an E2E test message.' },
        state.agentB.jwt
      );
      expect(res.success).toBe(true);
      expect(res.data.content).toContain('Hello from Agent B');
      logOk(`Message sent — id: ${res.data.id}`);
    });

    test('Agent A sends a reply', async () => {
      logStep(3, 'Agent A sending reply...');
      const res = await mainPost(
        `/v1/conversations/${NETWORK_ID}/${state.conversationId}/messages`,
        { content: 'Hello from Agent A! Great to connect in this E2E test.' },
        state.agentA.jwt
      );
      expect(res.success).toBe(true);
      logOk(`Agent A replied — id: ${res.data.id}`);
    });

    test('Agent A reads all messages', async () => {
      logStep(4, 'Fetching all messages...');
      const res = await mainGet(
        `/v1/conversations/${NETWORK_ID}/${state.conversationId}/messages`
      );
      expect(res.success).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(2);
      const senders = res.data.map((m: any) => m.senderId);
      expect(senders).toContain(state.agentB.publicToken);
      expect(senders).toContain(state.agentA.publicToken);
      logOk(`Found ${res.data.length} messages`);
    });

    test('fetches conversation insights', async () => {
      logStep(5, 'Fetching conversation insights...');
      const res = await mainGet(`/v1/conversations/${NETWORK_ID}/${state.conversationId}/insights`);
      logOk(`Insights responded — success: ${res.success}`);
    });

    test('topic appears in Agent B mine listing', async () => {
      logStep(6, "Fetching Agent B's conversations (mine)...");
      const res = await mainGet('/v1/conversations/mine', state.agentB.jwt);
      expect(res.success).toBe(true);
      const found = res.data.find((c: any) => c.id === state.conversationId);
      expect(found).toBeDefined();
      logOk('Conversation in Agent B mine listing');
    });
  });

  describe('Op 8: Propose Connection', () => {
    test('creates Firebase users for Human A and Human B', async () => {
      const emailA = `${TEST_PREFIX}-humana@e2etest.com`;
      const emailB = `${TEST_PREFIX}-humanb@e2etest.com`;

      logStep(1, `Creating Human A (${emailA})...`);
      state.humanA = await createFirebaseUser(emailA, 'TestPass123!E2E');
      expect(state.humanA.uid).toBeDefined();
      logOk(`Human A created — uid: ${state.humanA.uid}`);

      logStep(2, `Creating Human B (${emailB})...`);
      state.humanB = await createFirebaseUser(emailB, 'TestPass123!E2E');
      expect(state.humanB.uid).toBeDefined();
      logOk(`Human B created — uid: ${state.humanB.uid}`);
    });

    test('creates profiles for both humans', async () => {
      logStep(2.5, 'Creating Human A profile...');
      await humansPut('/v1/profile', {
        displayName: 'E2E Human A',
        email: state.humanA.email,
      }, state.humanA.idToken);
      logOk('Human A profile created');

      await humansPut('/v1/profile', {
        displayName: 'E2E Human B',
        email: state.humanB.email,
      }, state.humanB.idToken);
      logOk('Human B profile created');
    });

    test('Human A registers identity linking to Agent A', async () => {
      logStep(3, 'Human A registering identity for Agent A...');
      const res = await humansPost('/v1/identities', {
        networkId: NETWORK_ID,
        publicToken: state.agentA.publicToken,
        agentDescription: 'E2E Test Agent A - owned by Human A',
      }, state.humanA.idToken);

      expect(res.success).toBe(true);
      expect(res.data.id).toBeDefined();
      state.identityAId = res.data.id;
      logOk(`Identity A registered — id: ${res.data.id}`);
    });

    test('Human B registers identity linking to Agent B', async () => {
      logStep(4, 'Human B registering identity for Agent B...');
      const res = await humansPost('/v1/identities', {
        networkId: NETWORK_ID,
        publicToken: state.agentB.publicToken,
        agentDescription: 'E2E Test Agent B - owned by Human B',
      }, state.humanB.idToken);

      expect(res.success).toBe(true);
      state.identityBId = res.data.id;
      logOk(`Identity B registered — id: ${res.data.id}`);
    });

    test('Agent A proposes connection to Agent B', async () => {
      logStep(5, 'Agent A proposing connection to Agent B...');
      const res = await humansPost('/v1/connections', {
        toAgentToken: state.agentB.publicToken,
        networkId: NETWORK_ID,
        fromExplanation: 'E2E test: Agent A wants to connect with Agent B.',
      }, state.agentA.jwt);

      expect(res.success).toBe(true);
      expect(res.data.id).toBeDefined();
      expect(res.data.status).toBe('proposed');

      state.connectionId = res.data.id;
      logOk(`Connection proposed — id: ${res.data.id}`);
      logDetail(`Status: ${res.data.status}`);
    });

    test('connection appears in Agent B pending list', async () => {
      logStep(6, 'Checking Agent B pending connections...');
      const res = await humansGet('/v1/connections/pending', state.agentB.jwt);
      expect(res.success).toBe(true);
      const found = res.data.find((c: any) => c.id === state.connectionId);
      expect(found).toBeDefined();
      logOk('Connection found in Agent B pending list');
    });
  });

  describe('Op 9: Accept Connection', () => {
    test('Agent B accepts the connection', async () => {
      logStep(1, `Agent B accepting connection ${state.connectionId}...`);
      const res = await humansPost(
        `/v1/connections/${state.connectionId}/agent-accept`,
        { toExplanation: 'E2E test: Agent B accepts the connection.' },
        state.agentB.jwt
      );
      expect(res.success).toBe(true);
      expect(res.data.status).toBe('agent_accepted');
      logOk(`Connection accepted — status: ${res.data.status}`);
    });

    test('Human A accepts the connection', async () => {
      logStep(2, 'Human A accepting connection...');
      const res = await humansPost(
        `/v1/connections/${state.connectionId}/human-accept`,
        {},
        state.humanA.idToken
      );
      expect(res.success).toBe(true);
      expect(['human_pending', 'connected']).toContain(res.data.status);
      logOk(`Human A accepted — status: ${res.data.status}`);
    });

    test('Human B accepts the connection → connected', async () => {
      logStep(3, 'Human B accepting connection...');
      const res = await humansPost(
        `/v1/connections/${state.connectionId}/human-accept`,
        {},
        state.humanB.idToken
      );
      expect(res.success).toBe(true);
      expect(res.data.status).toBe('connected');
      logOk('Connection is now CONNECTED!');
    });
  });

  describe('Op 10: Verify Final State & Cleanup', () => {
    test('lists contacts for Human A', async () => {
      logStep(1, "Listing Human A's contacts...");
      const res = await humansGet('/v1/contacts', state.humanA.idToken);
      expect(res.success).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(1);
      logOk(`Human A has ${res.data.length} contact(s)`);
    });

    test('lists contacts for Human B', async () => {
      logStep(2, "Listing Human B's contacts...");
      const res = await humansGet('/v1/contacts', state.humanB.idToken);
      expect(res.success).toBe(true);
      expect(res.data.length).toBeGreaterThanOrEqual(1);
      logOk(`Human B has ${res.data.length} contact(s)`);
    });

    test('lists mine networks for Agent A', async () => {
      logStep(3, "Fetching Agent A's networks (mine)...");
      const res = await mainGet('/v1/networks/mine', state.agentA.jwt);
      expect(res.success).toBe(true);
      const found = res.data.find((n: any) => n.id === NETWORK_ID);
      expect(found).toBeDefined();
      logOk('gamers-united found in Agent A mine networks');
    });

    test('Agent A can re-login', async () => {
      logStep(4, 'Re-logging Agent A...');
      const res = await mainPost('/v1/auth/login', {
        networkId: NETWORK_ID,
        publicToken: state.agentA.publicToken,
        privateKey: state.agentA.privateKey,
      });
      expect(res.success).toBe(true);
      expect(res.data.jwt).toBeDefined();
      expect(res.data.publicToken).toBe(state.agentA.publicToken);
      logOk('Agent A re-login successful');
    });

    test('Agent B can re-login', async () => {
      logStep(5, 'Re-logging Agent B...');
      const res = await mainPost('/v1/auth/login', {
        networkId: NETWORK_ID,
        publicToken: state.agentB.publicToken,
        privateKey: state.agentB.privateKey,
      });
      expect(res.success).toBe(true);
      logOk('Agent B re-login successful');
    });

    test('connection status is connected', async () => {
      logStep(6, "Checking Human A's connections...");
      const res = await humansGet('/v1/connections/mine', state.humanA.idToken);
      expect(res.success).toBe(true);
      const conn = res.data.find((c: any) => c.id === state.connectionId);
      expect(conn).toBeDefined();
      expect(conn.status).toBe('connected');
      logOk('Connection confirmed connected');
    });

    test('cleans up identities and Firebase users', async () => {
      logStep(7, 'Cleaning up test data...');
      await cleanupIdentities(state.humanA.idToken, state.identityAId);
      logOk('Identity A removed');
      await cleanupIdentities(state.humanB.idToken, state.identityBId);
      logOk('Identity B removed');
      await deleteFirebaseUser(state.humanA.idToken);
      logOk('Human A deleted');
      await deleteFirebaseUser(state.humanB.idToken);
      logOk('Human B deleted');
    });
  });

});
