describe('Schedule Management', () => {
  beforeEach(() => {
    // 1. Visit the login page
    cy.visit('http://localhost:3000');

    // 2. Log in as an admin
    cy.get('#username').type('admin');
    cy.get('#password').type('changeme');
    cy.get('button[type="submit"]').click();
  });

  it('should allow an admin to create a new schedule', () => {
    // 3. Click the "Schedule a New Card" button
    cy.contains('button', 'Schedule a New Card').click();

    // 4. Fill in the card title
    const scheduleTitle = `Test Schedule ${new Date().getTime()}`;
    cy.get('input[name="title"]').type(scheduleTitle);

    // 5. Select the first member from the "Assign to Member" dropdown
    cy.get('label:contains("Assign to Member")').parent().find('button').click(); // Open the dropdown
    cy.get('ul > li').first().click(); // Click on the first member

    // 6. Click the "Schedule Card" button
    cy.contains('button', 'Schedule Card').click();

    // 7. Verify that the new schedule appears in the schedule list
    cy.contains('h3', scheduleTitle).should('be.visible');
  });
});
