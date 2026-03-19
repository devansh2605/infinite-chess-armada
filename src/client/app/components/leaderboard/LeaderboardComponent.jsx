import React from 'react';
import HeaderContainer from '../../containers/header/HeaderContainer';
import UserListComponent from './UserListComponent';
import GameHistoryComponent from '../home/GameHistoryComponent';

const TABS = ['Bullet', 'Blitz', 'Classical', 'History'];

export default class LeaderboardComponent extends React.Component {
	constructor(props) {
		super(props);
		this.state = { activeTab: 'Bullet' };
	}

	componentWillMount() {
		this.props.fetchLeaderboard();
	}

	render() {
		const { activeTab } = this.state;
		const dataMap = { Bullet: this.props.bullet, Blitz: this.props.blitz, Classical: this.props.classical };

		return (
			<div className="bg-bg-base min-h-screen">
				<HeaderContainer />
				<div className="px-6 py-8 max-w-3xl mx-auto">
					<h1 className="text-text-main text-2xl font-bold mb-6">Leaderboard</h1>
					{/* Tab bar */}
					<div className="flex gap-1 border-b border-border-dim mb-6">
						{TABS.map(tab => (
							<button
								key={tab}
								onClick={() => this.setState({ activeTab: tab })}
								className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
									activeTab === tab
										? 'border-accent text-accent'
										: 'border-transparent text-text-dim hover:text-text-main'
								}`}
							>
								{tab}
							</button>
						))}
					</div>
					{activeTab === 'History' ? (
						<GameHistoryComponent standalone />
					) : (
						<UserListComponent data={dataMap[activeTab] || []} />
					)}
				</div>
			</div>
		);
	}
}
