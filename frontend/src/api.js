import axios from 'axios';

/**
 * @description Creates a centralized axios instance for all API calls.
 */
const apiClient = axios.create({
  baseURL: process.env.NODE_ENV === 'production' 
    ? '' 
    : 'http://localhost:5000',
  withCredentials: true // Important for sending cookies
});

/**
 * @description Sets up response interceptors to handle automatic token refresh.
 * @param {object} authContext - An object with functions to manage auth state.
 * @param {function} authContext.logout - The logout function from the AuthContext.
 * @param {function} authContext.setUser - The function to update user state.
 */
export const setupInterceptors = ({ setUser, logout }) => {
    let isRefreshing = false;
    let failedQueue = [];

    const processQueue = (error, token = null) => {
        failedQueue.forEach(prom => {
            if (error) {
                prom.reject(error);
            } else {
                prom.resolve(token);
            }
        });
        failedQueue = [];
    };

    apiClient.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config;

            // Check if the error is a 401 and we haven't already tried to refresh.
            if (error.response?.status === 401 && !originalRequest._retry) {
                if (isRefreshing) {
                    // If we are already refreshing, queue this request.
                    return new Promise((resolve, reject) => {
                        failedQueue.push({ resolve, reject });
                    })
                    .then(token => {
                        originalRequest.headers['Authorization'] = 'Bearer ' + token;
                        return apiClient(originalRequest);
                    })
                    .catch(err => Promise.reject(err));
                }

                originalRequest._retry = true;
                isRefreshing = true;

                try {
                    const { data } = await apiClient.post('/api/auth/refresh');
                    const newAccessToken = data.token;

                    // Update the user context and local storage
                    const storedUser = JSON.parse(localStorage.getItem('userInfo'));
                    storedUser.token = newAccessToken;
                    localStorage.setItem('userInfo', JSON.stringify(storedUser));
                    
                    // Update the user in the AuthContext
                    setUser(storedUser);

                    // Update the default header for subsequent requests
                    apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
                    
                    // Update the header of the original failed request
                    originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

                    // Process the queue with the new token
                    processQueue(null, newAccessToken);

                    // Retry the original request
                    return apiClient(originalRequest);
                } catch (refreshError) {
                    // When refresh fails, reject all queued requests and log the user out.
                    const rejectionError = new Error("Your session has expired. Please log in again.");
                    processQueue(rejectionError, null);
                    logout(true); // Pass true to indicate session expired
                    return Promise.reject(rejectionError);
                } finally {
                    isRefreshing = false;
                }
            }

            return Promise.reject(error);
        }
    );
};

export default apiClient;