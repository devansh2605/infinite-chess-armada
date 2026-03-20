import React from 'react';
import { Router, Route, browserHistory } from 'react-router';
import _ from 'lodash';
import axios from 'axios';
import NotificationSystem from 'react-notification-system';
import supabase from '../lib/supabaseClient';

const BACKEND = process.env.REACT_APP_BACKEND_URL || '';
import ResetContainer from '../containers/reset/ResetContainer';
import RegisterContainer from '../containers/register/RegisterContainer';
import LeaderboardContainer from '../containers/leaderboard/LeaderboardContainer';
import LoadingContainer from '../containers/game/LoadingContainer';
import GameContainer from '../containers/game/GameContainer';
import ProfileContainer from '../containers/profile/ProfileContainer';
import GameHistoryComponent from './home/GameHistoryComponent';
import AuthContainer from '../containers/auth/AuthContainer';
import LobbyContainerPage from '../containers/auth/LobbyContainer';
import LobbyWaitingRoomContainer from '../containers/auth/LobbyWaitingRoomContainer';

export default class RouteComponent extends React.Component {
	constructor(props) {
		super(props);
		this.requireProfileUser = this.requireProfileUser.bind(this);
		this.requireResetToken = this.requireResetToken.bind(this);
		this.requireGame = this.requireGame.bind(this);
		this.enterHomeComponent = this.enterHomeComponent.bind(this);
		this.requireAboutToPlay = this.requireAboutToPlay.bind(this);
	}

	componentDidMount() {
		// Restore Supabase session on page load so users stay logged in after refresh
		supabase.auth.getSession().then(({ data: { session } }) => {
			if (session && session.access_token) {
				axios.post(BACKEND + '/api/auth/verify', { token: session.access_token })
					.then(res => {
						if (res.data && res.data.user) {
							this.props.setUser({ ...res.data.user, token: session.access_token });
						}
					})
					.catch(() => {});
			}
		}).catch(() => {});
	}

	shouldComponentUpdate() { return false; }

	componentWillReceiveProps(nextProps) {
		if (!_.isEmpty(nextProps.notification)) {
			this.notificationSystem.addNotification(nextProps.notification);
			this.props.clearNotifications();
		}
	}

	requireAboutToPlay() {
		if (!localStorage.getItem('token') || !this.props.selectedGame.id) browserHistory.push('/local');
	}

	requireProfileUser(nextState) {
		this.props.updateSelectedProfile(nextState.params.splat);
	}

	requireResetToken(nextState) {
		const resetToken = nextState.params.splat;
		if (resetToken) { this.props.updateResetToken(resetToken); browserHistory.push('/reset/'); }
	}

	requireGame(nextState) {
		const gameID = nextState.params.splat;
		if (localStorage.getItem('token')) this.props.updateIsPlaying(gameID);
	}

	enterHomeComponent() {
		this.props.resetGameState();
		this.props.clearSelectedGame();
		return true;
	}

	render() {
		return (
			<div>
				<NotificationSystem ref={c => { this.notificationSystem = c; }} />
				<Router history={browserHistory}>
					<Route path="/auth" component={AuthContainer} />
					<Route path="/local" component={LobbyContainerPage} onEnter={this.enterHomeComponent} />
					<Route path="/lobby/*" component={LobbyWaitingRoomContainer} />
					<Route path="/user/*" component={ProfileContainer} onEnter={this.requireProfileUser} />
					<Route path="/register" component={RegisterContainer} />
					<Route path="/reset/*" component={ResetContainer} onEnter={this.requireResetToken} />
					<Route path="/leaderboard" component={LeaderboardContainer} />
					<Route path="/loading" component={LoadingContainer} onEnter={this.requireAboutToPlay} />
					<Route path="/game/*" component={GameContainer} onEnter={this.requireGame} />
					<Route path="/history" component={GameHistoryComponent} />
					<Route path="*" onEnter={() => browserHistory.push('/local')} />
				</Router>
			</div>
		);
	}
}
