import React from 'react';
import UserLinkComponent from '../../common/UserLinkComponent';

function fireNavigate(boardNum, fenIdx) {
	window.dispatchEvent(new CustomEvent('navigateToMove', { detail: { boardNum, fenIdx } }));
}

export default function GameMovesPanelComponent(props) {
	return (
		<div className="p-3">
			<div className="text-xs uppercase tracking-wide text-text-dim font-medium mb-2 px-1">Moves</div>
			<table className="w-full text-xs text-text-dim">
				<thead>
					<tr className="border-b border-border-dim">
						<th className="text-left pb-1.5 pr-1 w-6">#</th>
						<th className="text-left pb-1.5 pr-1"><UserLinkComponent user={props.game.player1} /></th>
						<th className="text-left pb-1.5 pr-1"><UserLinkComponent user={props.game.player2} /></th>
						<th className="text-left pb-1.5 pr-1"><UserLinkComponent user={props.game.player3} /></th>
						<th className="text-left pb-1.5"><UserLinkComponent user={props.game.player4} /></th>
					</tr>
				</thead>
				<tbody id="movesTableTBody">
					{props.moves.map((move, index) => (
						<tr key={index} className="border-b border-border-dim/40">
							<td className="py-0.5 pr-1 text-text-dim">{move.number}</td>
							<td
								className="py-0.5 pr-1 text-text-main font-mono"
								onClick={move.player1 ? () => fireNavigate(1, index * 2 + 1) : undefined}
								style={move.player1 ? { cursor: 'pointer' } : {}}
							>{move.player1}</td>
							<td
								className="py-0.5 pr-1 text-text-main font-mono"
								onClick={move.player2 ? () => fireNavigate(1, index * 2 + 2) : undefined}
								style={move.player2 ? { cursor: 'pointer' } : {}}
							>{move.player2}</td>
							<td
								className="py-0.5 pr-1 text-text-main font-mono"
								onClick={move.player3 ? () => fireNavigate(2, index * 2 + 1) : undefined}
								style={move.player3 ? { cursor: 'pointer' } : {}}
							>{move.player3}</td>
							<td
								className="py-0.5 text-text-main font-mono"
								onClick={move.player4 ? () => fireNavigate(2, index * 2 + 2) : undefined}
								style={move.player4 ? { cursor: 'pointer' } : {}}
							>{move.player4}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
