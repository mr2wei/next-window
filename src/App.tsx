import { HashRouter, Route, Routes } from 'react-router-dom'
import Navigation from './components/navigation'
import Dashboard from './pages/dashboard'
import './styles/app.css'

const links = [{ to: '/', label: 'Dashboard' }]

export default function App() {
	return (
		<HashRouter>
			<div className="site">
				<Navigation links={links} />
				<main className="content">
					<Routes>
						<Route path="/" element={<Dashboard />} />
					</Routes>
				</main>
			</div>
		</HashRouter>
	)
}
