import React from 'react';
import { browserHistory } from 'react-router';

function teamResult(termination) {
	if (!termination) return { winner: null, text: 'Game Over' };
	if (termination.includes('Team 1 is victorious') || termination.includes('Team 1 is Victorious')) {
		return { winner: 'team1', text: 'Team 1 Wins!' };
	}
	if (termination.includes('Team 2 is victorious') || termination.includes('Team 2 is Victorious')) {
		return { winner: 'team2', text: 'Team 2 Wins!' };
	}
	return { winner: 'draw', text: 'Draw' };
}

const SLOT_CONFIG = {
	1: { label: 'P1 — White', team: 1, teamLabel: 'Team 1', teamClass: 'text-accent' },
	2: { label: 'P2 — Black', team: 2, teamLabel: 'Team 2', teamClass: 'text-accent-blue' },
	3: { label: 'P3 — White', team: 2, teamLabel: 'Team 2', teamClass: 'text-accent-blue' },
	4: { label: 'P4 — Black', team: 1, teamLabel: 'Team 1', teamClass: 'text-accent' },
};

export default function PostGameModal({ termination, ratingDeltas, gameId, onClose }) {
	if (!termination) return null;

	const { winner, text } = teamResult(termination);

	return (
		<div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm">
			<div className="bg-bg-card border border-border-dim rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
				{/* Header */}
				<div className={`px-6 py-5 text-center border-b border-border-dim ${
					winner === 'team1' ? 'bg-orange-900/20' : winner === 'team2' ? 'bg-blue-900/20' : 'bg-bg-panel'
				}`}>
					<div className="text-3xl mb-1">
						{winner === 'draw' ? '🤝' : '🏆'}
					</div>
					<h2 className={`text-2xl font-bold ${
						winner === 'team1' ? 'text-accent' : winner === 'team2' ? 'text-accent-blue' : 'text-text-main'
					}`}>{text}</h2>
					<p className="text-text-dim text-sm mt-1">{termination}</p>
				</div>

				{/* Rating deltas */}
				<div className="px-6 py-4">
					{ratingDeltas ? (
						<div>
							<h3 className="text-text-dim text-xs font-semibold uppercase tracking-wide mb-3">Rating Changes</h3>
							<div className="grid grid-cols-2 gap-3">
								{[1, 2, 3, 4].map(slot => {
									const cfg = SLOT_CONFIG[slot];
									const delta = ratingDeltas && ratingDeltas[slot];
									if (!delta) return (
										<div key={slot} className="bg-bg-panel rounded-lg p-3">
											<div className="text-text-dim text-xs mb-1">{cfg.label}</div>
											<div className={`text-xs font-medium mb-1 ${cfg.teamClass}`}>{cfg.teamLabel}</div>
											<div className="text-text-dim text-sm">Engine</div>
										</div>
									);
									const isWinner = (winner === 'team1' && cfg.team === 1) || (winner === 'team2' && cfg.team === 2);
									return (
										<div key={slot} className={`bg-bg-panel rounded-lg p-3 border ${isWinner && winner !== 'draw' ? 'border-accent/30' : 'border-border-dim'}`}>
											<div className="text-text-dim text-xs mb-1">{cfg.label}</div>
											<div className={`text-xs font-medium mb-2 ${cfg.teamClass}`}>{cfg.teamLabel}</div>
											<div className="font-bold text-text-main text-base">{delta.newRating}</div>
											<div className={`text-sm font-semibold ${delta.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
												{delta.delta >= 0 ? '+' : ''}{delta.delta}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					) : (
						<p className="text-text-dim text-sm text-center py-2">Loading rating changes…</p>
					)}
				</div>

				{/* Actions */}
				<div className="px-6 pb-5 flex gap-3">
					<button
						onClick={() => browserHistory.push('/local')}
						className="flex-1 bg-accent hover:bg-orange-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
					>
						Play Again
					</button>
					{onClose && (
						<button
							onClick={onClose}
							className="flex-1 bg-bg-panel hover:bg-bg-hover text-text-main font-semibold py-2.5 rounded-lg transition-colors text-sm border border-border-dim"
						>
							View Board
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
