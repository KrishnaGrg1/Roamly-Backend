import { config } from 'dotenv';

config();

interface iEnv {
  [key: string]: string | undefined;
}

const env = process.env as iEnv;
export default env;
