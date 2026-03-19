import React from 'react';
import { socketGame } from '../../../socket';

export default class GameActionsPanelComponent extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			offerResignDisabled: false,
			offerDrawDisabled: false,
			resignChoiceDisabled: false,
			drawChoiceDisabled: false
		};
		this.emitData = {
			id: this.props.id,
			userPosition: this.props.userPosition,
			token: this.props.localMode ? this.props.playerTokens.player1Token : localStorage.getItem('token')
		};
		this.handleOfferResign = this.handleOfferResign.bind(this);
		this.handleOfferDraw = this.handleOfferDraw.bind(this);
		this.handleAcceptResign = this.handleAcceptResign.bind(this);
		this.handleDeclineResign = this.handleDeclineResign.bind(this);
		this.handleAcceptDraw = this.handleAcceptDraw.bind(this);
		this.handleDeclineDraw = this.handleDeclineDraw.bind(this);
	}

	componentWillReceiveProps(nextProps) {
		if (nextProps.displayResignChoice) this.setState({ resignChoiceDisabled: false });
		else this.setState({ offerResignDisabled: false });
		if (nextProps.displayDrawChoice) this.setState({ drawChoiceDisabled: false });
		else this.setState({ offerDrawDisabled: false });
	}

	handleOfferResign() {
		socketGame.emit('offer resign', this.emitData);
		this.props.updateDisplayResignChoice(false);
		this.setState({ offerResignDisabled: true });
	}

	handleOfferDraw() {
		socketGame.emit('offer draw', this.emitData);
		this.props.updateDisplayDrawChoice(false);
		this.setState({ offerDrawDisabled: true });
	}

	handleAcceptResign() {
		socketGame.emit('accept resign', this.emitData);
		this.setState({ resignChoiceDisabled: true });
	}

	handleDeclineResign() {
		socketGame.emit('decline resign', this.emitData);
		this.setState({ resignChoiceDisabled: true });
	}

	handleAcceptDraw() {
		socketGame.emit('accept draw', this.emitData);
		this.setState({ drawChoiceDisabled: true });
	}

	handleDeclineDraw() {
		socketGame.emit('decline draw', this.emitData);
		this.setState({ drawChoiceDisabled: true });
	}

	renderResignPanel() {
		if (!this.props.displayResignChoice) {
			return (
				<button
					onClick={this.handleOfferResign}
					disabled={this.state.offerResignDisabled}
					className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded border border-border-dim text-text-dim text-xs font-medium hover:border-red-500 hover:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
				>
					<i className="fa fa-flag" /> Resign
				</button>
			);
		}
		return (
			<div className="flex-1 flex flex-col gap-1">
				<div className={`text-xs font-medium text-red-400 text-center ${!this.state.resignChoiceDisabled ? 'animate-pulse' : ''}`}>
					Resign offered — accept?
				</div>
				<div className="flex gap-1">
					<button
						onClick={this.handleAcceptResign}
						disabled={this.state.resignChoiceDisabled}
						className="flex-1 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors disabled:opacity-40"
					>
						Accept
					</button>
					<button
						onClick={this.handleDeclineResign}
						disabled={this.state.resignChoiceDisabled}
						className="flex-1 py-1 rounded border border-border-dim text-text-dim hover:text-text-main text-xs font-medium transition-colors disabled:opacity-40"
					>
						Decline
					</button>
				</div>
			</div>
		);
	}

	renderDrawPanel() {
		if (!this.props.displayDrawChoice) {
			return (
				<button
					onClick={this.handleOfferDraw}
					disabled={this.state.offerDrawDisabled}
					className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded border border-border-dim text-text-dim text-xs font-medium hover:border-accent-blue hover:text-accent-blue transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
				>
					<i className="fa fa-handshake-o" /> Draw
				</button>
			);
		}
		return (
			<div className="flex-1 flex flex-col gap-1">
				<div className={`text-xs font-medium text-accent-blue text-center ${!this.state.drawChoiceDisabled ? 'animate-pulse' : ''}`}>
					Draw offered — accept?
				</div>
				<div className="flex gap-1">
					<button
						onClick={this.handleAcceptDraw}
						disabled={this.state.drawChoiceDisabled}
						className="flex-1 py-1 rounded bg-accent-blue hover:bg-blue-400 text-white text-xs font-medium transition-colors disabled:opacity-40"
					>
						Accept
					</button>
					<button
						onClick={this.handleDeclineDraw}
						disabled={this.state.drawChoiceDisabled}
						className="flex-1 py-1 rounded border border-border-dim text-text-dim hover:text-text-main text-xs font-medium transition-colors disabled:opacity-40"
					>
						Decline
					</button>
				</div>
			</div>
		);
	}

	render() {
		return (
			<div className="flex gap-2 pt-2">
				{this.renderResignPanel()}
				{this.renderDrawPanel()}
			</div>
		);
	}
}
