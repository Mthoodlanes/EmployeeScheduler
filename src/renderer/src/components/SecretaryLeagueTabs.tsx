import { NavLink } from 'react-router-dom';

interface SecretaryLeagueTabsProps {
  leagueId: number;
}

function tabClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'btn btn-toggle active' : 'btn btn-toggle';
}

/** Sub-nav for one league's pages, shown under the page header on each — Weekly Banking and Bowler/Season Summary (Milestones 8-9) will add their own tabs here too. */
export function SecretaryLeagueTabs({ leagueId }: SecretaryLeagueTabsProps): React.JSX.Element {
  return (
    <div className="secretary-league-tabs">
      <NavLink to={`/secretary/leagues/${leagueId}`} end className={tabClassName}>
        Setup
      </NavLink>
      <NavLink to={`/secretary/leagues/${leagueId}/roster`} className={tabClassName}>
        Roster
      </NavLink>
      <NavLink to={`/secretary/leagues/${leagueId}/weekly-entries`} className={tabClassName}>
        Weekly Entries
      </NavLink>
    </div>
  );
}
