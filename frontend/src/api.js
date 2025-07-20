import axios from 'axios';

/**
 * @description Creates a centralized axios instance for all API calls.
 */
const apiClient = axios.create({
  baseURL: process.env.NODE_ENV === 'production' 
    ? '' 
    : 'http://localhost:5000'
});

/**
 * @description Sets up response interceptors for the API client.
 * This allows us to handle global error cases, like an expired token.
 * @param {function} logout - The logout function from the AuthContext.
 */
export const setupInterceptors = (logout) => {
    apiClient.interceptors.response.use(
        // If the response is successful, just return it.
        (response) => {
            return response;
        },
        // If the response is an error, check if it's a 401 (Unauthorized).
        (error) => {
            if (error.response && error.response.status === 401) {
                // If the token is expired or invalid, call the logout function
                // that was provided by the AuthContext.
                console.log('Session expired. Logging out.');
                logout();
            }
            // Be sure to reject the promise so that individual components
            // can still handle other types of errors if they need to.
            return Promise.reject(error);
        }
    );
};

export default apiClient;