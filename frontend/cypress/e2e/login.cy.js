describe('Login Flow', () => {
  it('should allow a user to log in and see the dashboard', () => {
    // 1. Visit the login page
    cy.visit('http://localhost:3000');

    // 2. Find the username field, type in it
    cy.get('#username').type('admin');

    // 3. Find the password field, type in it
    cy.get('#password').type('changeme'); // Using the default password from your README

    // 4. Find the submit button and click it
    cy.get('button[type="submit"]').click();

    // 5. Assert that the login was successful by looking for an element
    //    on the main page, like the "Scheduler Status" heading.
    cy.contains('h3', 'Scheduler Status').should('be.visible');
  });
});