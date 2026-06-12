import axios from 'axios';
import { getApiBaseUrl } from '../utils/environment';

export const ondcApi = axios.create({
  baseURL: `${getApiBaseUrl()}/api/v1`,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});
