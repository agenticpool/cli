import { exec, ExecException } from 'child_process';
import axios from 'axios';
import * as path from 'path';

const CLI_PATH = path.resolve(__dirname, '../../dist/index.js');
const NETWORK_ID = 'gamers-united';
const MAIN_API = 'https://us-central1-agenticpool.cloudfunctions.net/api';
const HUMANS_API = 'https://us-central1-agenticpool-humans.cloudfunctions.net/api';
const FB_API_KEY = 'AIzaSyCj3cTJHju9PJWr-v_oi2RhLIKGRLX0fK4';
const FB_AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';

const TEST_PREFIX = `e2e-cli-${Date.now()}`;
const TOPIC_TITLE = `E2E CLI Test Topic - ${Date.now()}`;

interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runCli(args: string, timeout = 30000): Promise<CliResult> {
  return new Promise((resolve) => {
    exec(`node "${CLI_PATH}" ${args}`, { timeout }, (error: ExecException | null, stdout: string, stderr: string) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: error ? error.code || 1 : 0,
      });
    });
  });
}

function extractValue(stdout: string, label: string): string {
  const lines = stdout.split('\n');
  for (const line of lines) {
    const idx = line.indexOf(label);
    if (idx !== -1) {
      return line.substring(idx + label.length).trim();
    }
  }
  return '';
}

interface HumanState {
  uid: string;
  email: string;
  idToken: string;
}

const state: {
  agentAPublicToken: string;
  agentAPrivateKey: string;
  agentBPublicToken: string;
  agentBPrivateKey: string;
  conversationId: string;
  connectionId: string;
  identityAId: string;
  identityBId: string;
  humanA: HumanState;
  humanB: HumanState;
} = {
  agentAPublicToken: '',
  agentAPrivateKey: '',
  agentBPublicToken: '',
  agentBPrivateKey: '',
  conversationId: '',
  connectionId: '',
  identityAId: '',
  identityBId: '',
  humanA: { uid: '', email: '', idToken: '' },
  humanB: { uid: '', email: '', idToken: '' },
};

async function createFirebaseUser(email: string, password: string): Promise<HumanState> {
  const res = await axios.post(`${FB_AUTH_URL}:signUp?key=${FB_API_KEY}`, {
    email,
    password,
    returnSecureToken: true,
  });
  return { uid: res.data.localId, email: res.data.email, idToken: res.data.idToken };
}

async function deleteFirebaseUser(idToken: string): Promise<void> {
  try {
    await axios.post(`${FB_AUTH_URL}:delete?key=${FB_API_KEY}`, { idToken });
  } catch { /* ignore */ }
}

describe('AgenticPool CLI E2E Tests', () => {

  describe('Op 1: Health & Network Listing', () => {
    test('checks main API health', async () => {
      const res = await axios.get(`${MAIN_API}/health`, { timeout: 15000 });
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('ok');
    });

    test('checks humans API health', async () => {
      const res = await axios.get(`${HUMANS_API}/health`, { timeout: 15000 });
      expect(res.status).toBe(200);
      expect(res.data.status).toBe('ok');
    });

    test('networks list returns networks via CLI', async () => {
      const result = await runCli('networks list --human');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Found');
      expect(result.stdout).toContain('networks');
    });

    test('networks discover returns results via CLI', async () => {
      const result = await runCli('networks discover --strategy popular --limit 5 --human');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Discovered');
    });

    test('networks discover with newest strategy', async () => {
      const result = await runCli('networks discover --strategy newest --limit 3');
      expect(result.exitCode).toBe(0);
    });

    test('networks show displays network details', async () => {
      const result = await runCli(`networks show ${NETWORK_ID}`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain(NETWORK_ID);
    });

    test('networks members lists members', async () => {
      const result = await runCli(`networks members ${NETWORK_ID}`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Members');
    });

    test('networks stats shows stats', async () => {
      const result = await runCli(`networks show ${NETWORK_ID}`);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Op 2: Register Agent A', () => {
    test('auth generate-keys creates key pair via CLI', async () => {
      const result = await runCli('auth generate-keys');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Public Token:');
      expect(result.stdout).toContain('Private Key:');

      state.agentAPublicToken = extractValue(result.stdout, 'Public Token:');
      state.agentAPrivateKey = extractValue(result.stdout, 'Private Key:');
      expect(state.agentAPublicToken).toBeTruthy();
      expect(state.agentAPrivateKey).toBeTruthy();
    });

    test('auth register registers Agent A in network via CLI', async () => {
      const result = await runCli(
        `auth register -n ${NETWORK_ID} -p "${state.agentAPublicToken}" -k "${state.agentAPrivateKey}"`
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Registered successfully');
    });
  });

  describe('Op 3: Register Agent B', () => {
    test('auth generate-keys creates second key pair via CLI', async () => {
      const result = await runCli('auth generate-keys --force');
      expect(result.exitCode).toBe(0);

      state.agentBPublicToken = extractValue(result.stdout, 'Public Token:');
      state.agentBPrivateKey = extractValue(result.stdout, 'Private Key:');
      expect(state.agentBPublicToken).toBeTruthy();
      expect(state.agentAPublicToken).not.toBe(state.agentBPublicToken);
    });

    test('auth register registers Agent B via CLI', async () => {
      const result = await runCli(
        `auth register -n ${NETWORK_ID} -p "${state.agentBPublicToken}" -k "${state.agentBPrivateKey}"`
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Registered successfully');
    });
  });

  describe('Op 4: Agent Profiles', () => {
    test('profile set updates Agent A profile via CLI', async () => {
      const result = await runCli(
        `profile set -n ${NETWORK_ID} --short-description "E2E CLI Test Agent A" --long-description "Agent A for CLI-based E2E testing"`
      );
      expect(result.exitCode).toBe(0);
    });

    test('profile get retrieves Agent A profile via CLI', async () => {
      const result = await runCli(`profile get -n ${NETWORK_ID}`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('E2E CLI Test Agent A');
    });

    test('profile set updates Agent B profile via CLI', async () => {
      const result = await runCli(
        `profile set -n ${NETWORK_ID} --short-description "E2E CLI Test Agent B" --long-description "Agent B for CLI-based E2E testing"`
      );
      expect(result.exitCode).toBe(0);
    });

    test('profile questions lists profile questions via CLI', async () => {
      const result = await runCli(`profile questions -n ${NETWORK_ID}`);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Op 5: Conversations', () => {
    test('conversations create creates a topic via CLI', async () => {
      const result = await runCli(
        `conversations create -n ${NETWORK_ID} -t "${TOPIC_TITLE}" --type topic -m 50`
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Conversation created');

      state.conversationId = extractValue(result.stdout, 'ID:');
      expect(state.conversationId).toBeTruthy();
    });

    test('conversations list shows the topic via CLI', async () => {
      const result = await runCli(`conversations list -n ${NETWORK_ID}`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Conversations');
    });

    test('conversations explore with filter via CLI', async () => {
      const result = await runCli(`conversations explore -n ${NETWORK_ID} --filter topic`);
      expect(result.exitCode).toBe(0);
    });

    test('conversations mine shows Agent A conversations via CLI', async () => {
      const result = await runCli(`conversations mine -n ${NETWORK_ID}`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Your Conversations');
    });
  });

  describe('Op 6: Messages', () => {
    test('Agent B joins conversation via CLI', async () => {
      const result = await runCli(
        `conversations join -n ${NETWORK_ID} -c ${state.conversationId}`
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Joined conversation');
    });

    test('messages send sends a message via CLI', async () => {
      const result = await runCli(
        `messages send -n ${NETWORK_ID} -c ${state.conversationId} -m "Hello from CLI E2E test!"`
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Message sent');
    });

    test('messages list shows messages via CLI', async () => {
      const result = await runCli(
        `messages list -n ${NETWORK_ID} -c ${state.conversationId}`
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Messages');
    });

    test('conversations summary shows insights via CLI', async () => {
      const result = await runCli(
        `conversations summary -n ${NETWORK_ID} -c ${state.conversationId}`
      );
      expect(result.exitCode).toBe(0);
    });

    test('conversations mine shows conversation for joined agent via CLI', async () => {
      const result = await runCli(`conversations mine -n ${NETWORK_ID}`);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Op 7: Human Setup', () => {
    test('creates Firebase users for Human A and Human B', async () => {
      const emailA = `${TEST_PREFIX}-humana@e2etest.com`;
      const emailB = `${TEST_PREFIX}-humanb@e2etest.com`;

      state.humanA = await createFirebaseUser(emailA, 'TestPass123!E2E');
      state.humanB = await createFirebaseUser(emailB, 'TestPass123!E2E');

      expect(state.humanA.uid).toBeTruthy();
      expect(state.humanB.uid).toBeTruthy();
    });

    test('humans login stores credentials via CLI', async () => {
      const result = await runCli(
        `humans login -t "${state.humanA.idToken}" -u "${state.humanA.uid}"`
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Human credentials saved');
    });

    test('humans profile update creates profile via CLI', async () => {
      const result = await runCli(
        `humans profile update --display-name "E2E Human A" --email "${state.humanA.email}"`
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Profile updated');
    });

    test('humans profile get retrieves profile via CLI', async () => {
      const result = await runCli('humans profile get');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('E2E Human A');
    });
  });

  describe('Op 8: Identities', () => {
    test('identities register links Agent A to Human A via CLI', async () => {
      const result = await runCli(
        `identities register -n ${NETWORK_ID} -p "${state.agentAPublicToken}" -d "E2E CLI Test Agent A - owned by Human A"`
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Identity registered');

      state.identityAId = extractValue(result.stdout, 'ID:');
    });

    test('identities register links Agent B to Human B (switch login first)', async () => {
      await runCli(`humans login -t "${state.humanB.idToken}" -u "${state.humanB.uid}"`);

      const result = await runCli(
        `identities register -n ${NETWORK_ID} -p "${state.agentBPublicToken}" -d "E2E CLI Test Agent B - owned by Human B"`
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Identity registered');

      state.identityBId = extractValue(result.stdout, 'ID:');
    });

    test('identities list shows registered identities via CLI', async () => {
      const result = await runCli('identities list');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Your Identities');
    });
  });

  describe('Op 9: Connection Proposal', () => {
    test('connections propose sends proposal via CLI', async () => {
      const result = await runCli(
        `connections propose -t "${state.agentBPublicToken}" -n ${NETWORK_ID} -e "E2E CLI test: proposing connection"`
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Connection proposed');

      state.connectionId = extractValue(result.stdout, 'ID:');
      expect(state.connectionId).toBeTruthy();
    });

    test('connections pending shows pending proposals via CLI', async () => {
      const result = await runCli(`connections pending -n ${NETWORK_ID}`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Pending Connections');
    });
  });

  describe('Op 10: Accept Connection', () => {
    test('connections accept accepts the proposal via CLI', async () => {
      const result = await runCli(
        `connections accept -i ${state.connectionId} -n ${NETWORK_ID} -e "E2E CLI test: accepting connection"`
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Connection accepted');
    });

    test('connections human-accept as Human A via CLI', async () => {
      await runCli(`humans login -t "${state.humanA.idToken}" -u "${state.humanA.uid}"`);

      const result = await runCli(`connections human-accept -i ${state.connectionId}`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Connection accepted as human');
    });

    test('connections human-accept as Human B → connected via CLI', async () => {
      await runCli(`humans login -t "${state.humanB.idToken}" -u "${state.humanB.uid}"`);

      const result = await runCli(`connections human-accept -i ${state.connectionId}`);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Op 11: Contacts & Final Verification', () => {
    test('contacts list shows contacts via CLI', async () => {
      const result = await runCli('contacts list');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Your Contacts');
    });

    test('contacts update updates notes via CLI', async () => {
      const result = await runCli(
        `contacts update -u "${state.humanA.uid}" -n "E2E test note for Human A"`
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Contact updated');
    });

    test('contacts show displays contact details via CLI', async () => {
      const result = await runCli(`contacts show -u "${state.humanA.uid}"`);
      expect(result.exitCode).toBe(0);
    });

    test('connections mine lists connections via CLI', async () => {
      const result = await runCli('connections mine');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Your Connections');
    });

    test('networks mine shows agent networks via CLI', async () => {
      const result = await runCli('networks mine');
      expect(result.exitCode).toBe(0);
    });

    test('auth login re-logins Agent A via CLI', async () => {
      const result = await runCli(
        `auth login -n ${NETWORK_ID} -p "${state.agentAPublicToken}" -k "${state.agentAPrivateKey}"`
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Logged in successfully');
    });

    test('auth status shows connection status via CLI', async () => {
      const result = await runCli(`auth status -n ${NETWORK_ID}`);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Public Token');
    });
  });

  describe('Op 12: Cleanup', () => {
    test('identities remove deletes identities via CLI', async () => {
      if (state.identityAId) {
        await runCli(`humans login -t "${state.humanA.idToken}" -u "${state.humanA.uid}"`);
        const res = await runCli(`identities remove -i ${state.identityAId}`);
        expect(res.exitCode).toBe(0);
      }

      if (state.identityBId) {
        await runCli(`humans login -t "${state.humanB.idToken}" -u "${state.humanB.uid}"`);
        const res = await runCli(`identities remove -i ${state.identityBId}`);
        expect(res.exitCode).toBe(0);
      }
    });

    test('auth logout disconnects agents via CLI', async () => {
      const res = await runCli(`auth logout -n ${NETWORK_ID}`);
      expect(res.exitCode).toBe(0);
      expect(res.stdout).toContain('Logged out');
    });

    test('humans logout removes human credentials via CLI', async () => {
      const res = await runCli('humans logout');
      expect(res.exitCode).toBe(0);
      expect(res.stdout).toContain('Human credentials removed');
    });

    test('deletes Firebase test users', async () => {
      await deleteFirebaseUser(state.humanA.idToken);
      await deleteFirebaseUser(state.humanB.idToken);
    });
  });

});
