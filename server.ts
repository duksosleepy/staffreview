import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { createClient } from 'gel';

const port = Number.parseInt(process.env.PORT || '3001', 10);
const dev = process.env.NODE_ENV !== 'production';
const client = createClient();

type QueryRequestBody = {
  query: string;
  variables?: Record<string, unknown>;
};

const parseBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString()));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

const setCorsHeaders = (res: ServerResponse) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};

const handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  if (req.method === 'POST' && req.url === '/api/query') {
    try {
      const body = await parseBody(req);
      const { query, variables } = JSON.parse(body) as QueryRequestBody;
      const result = variables
        ? await client.query(query, variables)
        : await client.query(query);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(result));
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error }));
    }
  }

  res.writeHead(404);
  return res.end('Not found');
};

createServer(handleRequest).listen(port, () => {
  console.log(
    `> Server listening at http://localhost:${port} as ${dev ? 'development' : process.env.NODE_ENV}`,
  );
});
