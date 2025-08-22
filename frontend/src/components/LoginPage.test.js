import { render, screen } from '@testing-library/react';
import { AuthProvider } from '../context/AuthContext';
import LoginPage from './LoginPage';

// Mock the ThemeToggle component as it's not relevant to this test
jest.mock('./ThemeToggle', () => () => <div data-testid="theme-toggle" />);

test('renders login page correctly', () => {
  render(
    <AuthProvider>
      <LoginPage />
    </AuthProvider>
  );

  // Check for the main heading
  expect(screen.getByRole('heading', { name: /Welcome Back/i })).toBeInTheDocument();

  // Check for form labels and inputs
  expect(screen.getByLabelText(/Username/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
  
  // Check for the sign-in button
  expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
  
  // Check that our mocked ThemeToggle is there
  expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
});