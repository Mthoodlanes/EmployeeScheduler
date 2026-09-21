import { NavLink } from 'react-router-dom';

interface SecretaryLeagueTabsProps {
  leagueId: number;
}

function tabClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'btn btn-toggle active' : 'btn btn-toggle';
}

/** Sub-nav for one league's pages (Setup, Roster, and — once Milestones 7-9 land — Weekly Entries/Banking/Summary), shown under the page header on each. */
export function SecretaryLeagueTabs({ leagueId }: SecretaryLeagueTabsProps): React.JSX.Element {
  return (
    <div className="secretary-league-tabs">
      <NavLink to={`/secretary/leagues/${leagueId}`} end className={tabClassName}>
        Setup
      </NavLink>
      <NavLink to={`/secretary/leagues/${leagueId}/roster`} className={tabClassName}>
        Roster
      </NavLink>
    </div>
  );
}
