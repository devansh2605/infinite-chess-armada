import React from 'react';
import axios from 'axios';
import HeaderContainer from '../../containers/header/HeaderContainer';

export default class GameHistoryComponent extends React.Component {
	constructor(props) {
		super(props);
		this.state = { games: [], loading: true };
	}

	componentDidMount() {
		axios.get('/api/games/history')
			.then(res => this.setState({ games: res.data, loading: false }))
			.catch(() => this.setState({ loading: false }));
	}

	render() {
		const { games, loading } = this.state;
		const showHeader = !this.props.standalone;

		function formatDate(ts) {
			if (!ts) return '—';
			return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
		}

		function resultLabel(termination) {
			if (!termination) return <span className="text-text-dim">—</span>;
			if (termination.includes('Team 1')) return <span className="text-accent font-medium">Team 1</span>;
			if (termination.includes('Team 2')) return <span className="text-accent-blue font-medium">Team 2</span>;
			return <span className="text-text-dim">Draw</span>;
		}

		const content = (
			<div className={showHeader ? 'px-6 py-8 bg-bg-base min-h-screen' : ''}>
				{showHeader && <h2 className="text-text-main text-xl font-semibold mb-4">Game History</h2>}
				{loading ? (
					<p className="text-text-dim text-sm">Loading...</p>
				) : games.length === 0 ? (
					<p className="text-text-dim text-sm">No completed games yet.</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm text-text-dim">
							<thead>
								<tr className="border-b border-border-dim text-xs uppercase tracking-wide">
									<th className="text-left pb-2 pr-4">Date</th>
									<th className="text-left pb-2 pr-4">Time</th>
									<th className="text-left pb-2 pr-4">Mode</th>
									<th className="text-left pb-2 pr-4">Team 1 (P1+P4)</th>
									<th className="text-left pb-2 pr-4">Team 2 (P2+P3)</th>
									<th className="text-left pb-2">Result</th>
								</tr>
							</thead>
							<tbody>
								{games.map(g => (
									<tr key={g.id} className="border-b border-border-dim hover:bg-bg-hover transition-colors">
										<td className="py-2 pr-4">{formatDate(g.timestamp)}</td>
										<td className="py-2 pr-4 text-text-main font-medium">{g.minutes}+{g.increment}</td>
										<td className="py-2 pr-4">
											<span className={`px-1.5 py-0.5 rounded text-xs font-medium ${g.mode === 'Rated' ? 'bg-accent-blue/20 text-accent-blue' : 'bg-bg-panel text-text-dim'}`}>
												{g.mode}
											</span>
										</td>
										<td className="py-2 pr-4 text-text-main">
											{g.p1} <span className="text-text-dim">&amp;</span> {g.p4}
										</td>
										<td className="py-2 pr-4 text-text-main">
											{g.p2} <span className="text-text-dim">&amp;</span> {g.p3}
										</td>
										<td className="py-2">{resultLabel(g.termination)}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		);

		if (!showHeader) return content;

		return (
			<div className="bg-bg-base min-h-screen">
				<HeaderContainer />
				{content}
			</div>
		);
	}
}
