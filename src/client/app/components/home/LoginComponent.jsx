import React from 'react';
import axios from 'axios';
import _ from 'lodash';
import { browserHistory } from 'react-router';
import { showErrorNotification } from '../../util/notifications';

export default class LoginComponent extends React.Component {
	constructor(props) {
		super(props);
		this.state = {
			username: '',
			password: ''
		};
		this.handleUsernameChange = this.handleUsernameChange.bind(this);
		this.handlePasswordChange = this.handlePasswordChange.bind(this);
		this.handleSubmit = this.handleSubmit.bind(this);
		this.handleForgotPassword = this.handleForgotPassword.bind(this);
	}

	componentWillMount() {
		const token = localStorage.getItem('token');
		if (token) {
			axios.post('/api/login/token', { token })
				.then(response => { this.props.updateCurrentUser(response.data); })
				.catch(() => { localStorage.removeItem('token'); });
		}
	}

	componentDidMount() {
		if (this.inputUsername) this.inputUsername.focus();
	}

	handleUsernameChange(e) { this.setState({ username: e.target.value }); }
	handlePasswordChange(e) { this.setState({ password: e.target.value }); }

	handleSubmit(e) {
		e.preventDefault();
		axios.post('/api/login/', { username: this.state.username, password: this.state.password })
			.then(response => {
				localStorage.setItem('token', response.data.token);
				this.props.updateCurrentUser(response.data.user);
			})
			.catch(() => {
				this.inputUsername.focus();
				showErrorNotification('Invalid username/password combination');
			});
		this.setState({ username: '', password: '' });
	}

	handleForgotPassword() { browserHistory.push('/reset/'); }

	render() {
		if (!_.isEmpty(this.props.currentUser)) return null;
		return (
			<div className="bg-bg-card border border-border-dim rounded-lg p-6 w-full max-w-sm">
				<h2 className="text-text-main text-xl font-semibold mb-5">Log in</h2>
				<form onSubmit={this.handleSubmit} className="flex flex-col gap-4">
					<div>
						<label className="block text-text-dim text-xs font-medium mb-1 uppercase tracking-wide">Username</label>
						<input
							type="text"
							ref={c => { this.inputUsername = c; }}
							maxLength="25"
							value={this.state.username}
							onChange={this.handleUsernameChange}
							className="w-full bg-bg-panel border border-border-dim rounded px-3 py-2 text-text-main text-sm focus:outline-none focus:border-accent"
						/>
					</div>
					<div>
						<label className="block text-text-dim text-xs font-medium mb-1 uppercase tracking-wide">Password</label>
						<input
							type="password"
							value={this.state.password}
							onChange={this.handlePasswordChange}
							className="w-full bg-bg-panel border border-border-dim rounded px-3 py-2 text-text-main text-sm focus:outline-none focus:border-accent"
						/>
					</div>
					<button
						type="submit"
						className="w-full bg-accent hover:bg-orange-400 text-white font-semibold py-2 rounded transition-colors text-sm"
					>
						Sign in
					</button>
					<button
						type="button"
						onClick={this.handleForgotPassword}
						className="text-text-dim hover:text-text-main text-xs text-center transition-colors bg-transparent border-none cursor-pointer"
					>
						Forgot password?
					</button>
				</form>
			</div>
		);
	}
}
