/**
 * Placeholder landing page for the Secretary area — proves the login door,
 * role guard, and layout all work end to end before any real dues-tracker
 * functionality exists. Later milestones replace this with the league
 * picker (or redirect straight to it once a Secretary has any leagues).
 */
export function SecretaryHomePage(): React.JSX.Element {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Secretary Dashboard</h1>
      </div>
      <p>The bowling dues tracker is being rebuilt here — check back soon.</p>
    </div>
  );
}
