import React from 'react';
import axios from 'axios';
import HeaderContainer from '../../containers/header/HeaderContainer';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';

export default class GameHistoryComponent extends React.Component {
	constructor(props) {
		super(props);
		this.state = { games: [], loading: true };
	}

	componentDidMount() {
		axios.get(`${BACKEND}/api/games/history`)
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

		function deltaDisplay(delta) {
			if (delta == null) return null;
			const rounded = Math.round(delta);
			if (rounded > 0) return <span className="text-green-400 text-xs font-medium ml-1">+{rounded}</span>;
			if (rounded < 0) return <span className="text-red-400 text-xs font-medium ml-1">{rounded}</span>;
			return <span className="text-text-dim text-xs ml-1">±0</span>;
		}

		function playerCell(name, ratingInfo) {
			if (!name) return <span className="text-text-dim italic text-sm">Engine</span>;
			const delta = ratingInfo ? ratingInfo.rating_after - ratingInfo.rating_before : null;
			return (
				<span className="flex items-center">
					<span className="text-text-main text-sm">{name}</span>
					{deltaDisplay(delta)}
				</span>
			);
		}

		const content = (
			<div>
				{showHeader && <h2 className="text-text-main text-xl font-semibold mb-4">Game History</h2>}
				{loading ? (
					<p className="text-text-dim text-sm">Loading...</p>
				) : games.length === 0 ? (
					<p className="text-text-dim text-sm">No completed games yet.</p>
				) : (
					<div className="space-y-3">
						{games.map(g => {
							const r = g.ratings || {};
							const team1Won = g.termination && g.termination.includes('Team 1');
							const team2Won = g.termination && g.termination.includes('Team 2');
							return (
								<div key={g.id} className="bg-bg-card border border-border-dim rounded-xl p-4">
									<div className="flex items-start justify-between gap-4">
										<div className="flex-1 min-w-0 space-y-2">
											<div className="flex items-center gap-2">
												<span className={`text-xs px-2 py-0.5 rounded font-semibold flex-shrink-0 ${team1Won ? 'bg-accent/20 text-accent' : 'bg-bg-panel text-text-dim'}`}>
													{team1Won ? 'W' : 'L'} Team 1
												</span>
												<div className="flex flex-col gap-0.5">
													{playerCell(g.p1, r[1])}
													{playerCell(g.p4, r[4])}
												</div>
											</div>
											<div className="flex items-center gap-2">
												<span className={`text-xs px-2 py-0.5 rounded font-semibold flex-shrink-0 ${team2Won ? 'bg-accent-blue/20 text-accent-blue' : 'bg-bg-panel text-text-dim'}`}>
													{team2Won ? 'W' : 'L'} Team 2
												</span>
												<div className="flex flex-col gap-0.5">
													{playerCell(g.p2, r[2])}
													{playerCell(g.p3, r[3])}
												</div>
											</div>
										</div>
										<div className="text-right flex-shrink-0 space-y-1">
											<div className="text-text-main text-sm font-semibold">{g.minutes}+{g.increment}</div>
											<span className={`text-xs px-1.5 py-0.5 rounded inline-block ${g.mode === 'Rated' ? 'bg-accent-blue/20 text-accent-blue' : 'bg-bg-panel text-text-dim'}`}>{g.mode || 'Rated'}</span>
											<div className="text-text-dim text-xs">{formatDate(g.created_at)}</div>
										</div>
									</div>
									{g.termination && (
										<div className="mt-2 pt-2 border-t border-border-dim text-xs text-text-dim">{g.termination}</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>
		);

		if (!showHeader) return content;

		return (
			<div className="bg-bg-base min-h-screen">
				<HeaderContainer />
				<div className="max-w-3xl mx-auto px-6 py-8">{content}</div>
			</div>
		);
	}
}
