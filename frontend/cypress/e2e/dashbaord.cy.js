describe('Dashboard Page', () => {
  beforeEach(() => {
    // 1. Visit the login page
    cy.visit('http://localhost:3000');

    // 2. Find the username field, type in it
    cy.get('#username').type('admin');

    // 3. Find the password field, type in it
    cy.get('#password').type('changeme');

    // 4. Find the submit button and click it
    cy.get('button[type="submit"]').click();

    // 5. Navigate to the dashboard by clicking the button with the text "Dashboard"
    cy.contains('button', 'Dashboard').click();
  });

  it('should display the main dashboard statistics', () => {
    // Check for the main heading
    cy.contains('h2', 'Dashboard').should('be.visible');

    // Check for the stat cards
    cy.contains('.bg-surface', 'Total Schedules').should('be.visible');
    cy.contains('.bg-surface', 'Total Cards Created').should('be.visible');

    // Check for the breakdown sections
    cy.contains('h3', 'Schedules per Category').should('be.visible');
    cy.contains('h3', 'Cards Created per User').should('be.visible');
  });
});
