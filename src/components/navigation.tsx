import { NavLink } from 'react-router-dom'
import type { NavigationProps } from '../types/nav-types'
import '../styles/navigation.css'

export default function Navigation({ links }: NavigationProps) {
  return (
    <nav>
      <ul className="navigation-list">
        {links.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
