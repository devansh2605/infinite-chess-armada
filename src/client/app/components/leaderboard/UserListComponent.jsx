import React from 'react';
import UserLinkComponent from '../common/UserLinkComponent';

export default function UserListComponent(props) {
	if (!props.data || props.data.length === 0) {
		return <p className="text-text-dim text-sm">No data yet.</p>;
	}
	return (
		<table className="w-full text-sm text-text-dim">
			<thead>
				<tr className="border-b border-border-dim text-xs uppercase tracking-wide">
					<th className="text-left pb-2 w-8">#</th>
					<th className="text-left pb-2">Player</th>
					<th className="text-right pb-2">Rating</th>
				</tr>
			</thead>
			<tbody>
				{props.data.map((user, i) => (
					<tr key={user.username} className="border-b border-border-dim hover:bg-bg-hover transition-colors">
						<td className="py-2 text-text-dim">{i + 1}</td>
						<td className="py-2">
							<div className="flex items-center gap-2">
								<div className="w-7 h-7 rounded-full bg-bg-panel flex items-center justify-center text-xs font-bold text-accent uppercase flex-shrink-0">
									{user.username[0]}
								</div>
								<UserLinkComponent user={user} />
							</div>
						</td>
						<td className="py-2 text-right">
							<span className="bg-bg-panel px-2 py-0.5 rounded text-text-main font-medium">
								{Math.round(user.rating)}
							</span>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
