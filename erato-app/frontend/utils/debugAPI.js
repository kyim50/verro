import Constants from 'expo-constants';

/**
 * Debug utility to check what API URL is being used
 */
export const debugAPI = () => {
  const configURL = Constants.expoConfig?.extra?.EXPO_PUBLIC_API_URL;
  const envURL = process.env.EXPO_PUBLIC_API_URL;
  const socketConfigURL = Constants.expoConfig?.extra?.EXPO_PUBLIC_SOCKET_URL;
  const socketEnvURL = process.env.EXPO_PUBLIC_SOCKET_URL;

  console.log('=== API URL Debug ===');
  console.log('Config EXPO_PUBLIC_API_URL:', configURL);
  console.log('Env EXPO_PUBLIC_API_URL:', envURL);
  console.log('Config EXPO_PUBLIC_SOCKET_URL:', socketConfigURL);
  console.log('Env EXPO_PUBLIC_SOCKET_URL:', socketEnvURL);
  console.log('Constants.expoConfig:', Constants.expoConfig?.extra);
  console.log('===================');

  return {
    apiURL: configURL || envURL || 'http://localhost:3000/api',
    socketURL: socketConfigURL || socketEnvURL || 'http://localhost:3000',
  };
};













