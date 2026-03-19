import React, { Component } from 'react';
import { browserHistory } from 'react-router';
import axios from 'axios';
import supabase from '../lib/supabaseClient';

export default class AuthPage extends Component {
	constructor(props) {
		super(props);
		this.state = {
			tab: 'login',
			email: '',
			password: '',
			username: '',
			confirmPassword: '',
			loading: false,
			error: '',
			usernameAvailable: null,
			checkingUsername: false,
		};
		this._usernameTimeout = null;
	}

	componentDidMount() {
		// If already logged in, go straight to lobby
		supabase.auth.getSession().then(({ data: { session } }) => {
			if (session) browserHistory.push('/local');
		});
	}

	handleUsernameChange(username) {
		this.setState({ username, usernameAvailable: null });
		clearTimeout(this._usernameTimeout);
		if (username.length < 3) return;
		this.setState({ checkingUsername: true });
		this._usernameTimeout = setTimeout(async () => {
			try {
				const res = await axios.get(`/api/auth/username/${username}`);
				this.setState({ usernameAvailable: res.data.available, checkingUsername: false });
			} catch (err) {
				this.setState({ checkingUsername: false });
			}
		}, 400);
	}

	async handleLogin(e) {
		e.preventDefault();
		this.setState({ loading: true, error: '' });
		const { email, password } = this.state;
		const { data, error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) {
			this.setState({ loading: false, error: error.message });
			return;
		}
		const profile = await this.fetchAndStoreProfile(data.session);
		if (profile) {
			this.props.setUser({ ...profile, token: data.session.access_token });
			browserHistory.push('/local');
		}
		this.setState({ loading: false });
	}

	async handleSignup(e) {
		e.preventDefault();
		const { email, password, confirmPassword, username, usernameAvailable } = this.state;
		if (password !== confirmPassword) return this.setState({ error: 'Passwords do not match' });
		if (password.length < 6) return this.setState({ error: 'Password must be at least 6 characters' });
		if (!username || username.length < 3) return this.setState({ error: 'Username must be at least 3 characters' });
		if (!/^[a-zA-Z0-9_]+$/.test(username)) return this.setState({ error: 'Username can only contain letters, numbers, and underscores' });
		if (usernameAvailable === false) return this.setState({ error: 'Username is already taken' });

		this.setState({ loading: true, error: '' });
		const { data, error } = await supabase.auth.signUp({
			email,
			password,
			options: { data: { username } },
		});
		if (error) {
			this.setState({ loading: false, error: error.message });
			return;
		}
		if (data.session) {
			// Auto-confirmed
			await new Promise(r => setTimeout(r, 800)); // give trigger time to create profile
			const profile = await this.fetchAndStoreProfile(data.session);
			if (profile) {
				this.props.setUser({ ...profile, token: data.session.access_token });
				browserHistory.push('/local');
			}
		} else {
			this.setState({ loading: false, error: '', tab: 'login' });
			alert('Check your email for a confirmation link, then log in.');
		}
	}

	async fetchAndStoreProfile(session) {
		try {
			const res = await axios.post('/api/auth/verify', { token: session.access_token });
			return res.data.user;
		} catch (err) {
			return null;
		}
	}

	render() {
		const { tab, email, password, username, confirmPassword, loading, error, usernameAvailable, checkingUsername } = this.state;

		return (
			<div className="min-h-screen bg-bg-base flex items-center justify-center px-4">
				<div className="w-full max-w-md">
					{/* Logo */}
					<div className="text-center mb-8">
						<div className="text-3xl font-bold tracking-tight mb-1">
							<span className="text-accent">Infinite</span>
							<span className="text-text-main"> Chess </span>
							<span className="text-accent-blue">Armada</span>
						</div>
						<p className="text-text-dim text-sm">4-player bughouse chess</p>
					</div>

					<div className="bg-bg-card border border-border-dim rounded-xl overflow-hidden shadow-2xl">
						{/* Tabs */}
						<div className="flex border-b border-border-dim">
							{['login', 'signup'].map(t => (
								<button
									key={t}
									onClick={() => this.setState({ tab: t, error: '' })}
									className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${
										tab === t ? 'text-accent border-b-2 border-accent bg-bg-base/30' : 'text-text-dim hover:text-text-main'
									}`}
								>
									{t === 'login' ? 'Log In' : 'Sign Up'}
								</button>
							))}
						</div>

						<div className="p-6">
							{error && (
								<div className="bg-red-900/30 border border-red-700/50 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
									{error}
								</div>
							)}

							{tab === 'login' ? (
								<form onSubmit={e => this.handleLogin(e)} className="space-y-4">
									<div>
										<label className="block text-text-dim text-xs mb-1 font-medium">Email</label>
										<input
											type="email" required autoComplete="email"
											value={email}
											onChange={e => this.setState({ email: e.target.value })}
											className="w-full bg-bg-panel border border-border-dim rounded-lg px-3 py-2.5 text-text-main text-sm focus:outline-none focus:border-accent transition-colors"
											placeholder="you@example.com"
										/>
									</div>
									<div>
										<label className="block text-text-dim text-xs mb-1 font-medium">Password</label>
										<input
											type="password" required autoComplete="current-password"
											value={password}
											onChange={e => this.setState({ password: e.target.value })}
											className="w-full bg-bg-panel border border-border-dim rounded-lg px-3 py-2.5 text-text-main text-sm focus:outline-none focus:border-accent transition-colors"
											placeholder="••••••••"
										/>
									</div>
									<button
										type="submit" disabled={loading}
										className="w-full bg-accent hover:bg-orange-400 disabled:bg-bg-panel disabled:text-text-dim text-white font-semibold py-2.5 rounded-lg transition-colors"
									>
										{loading ? 'Logging in…' : 'Log In'}
									</button>
								</form>
							) : (
								<form onSubmit={e => this.handleSignup(e)} className="space-y-4">
									<div>
										<label className="block text-text-dim text-xs mb-1 font-medium">Username</label>
										<div className="relative">
											<input
												type="text" required
												value={username}
												onChange={e => this.handleUsernameChange(e.target.value)}
												className={`w-full bg-bg-panel border rounded-lg px-3 py-2.5 text-text-main text-sm focus:outline-none transition-colors pr-8 ${
													usernameAvailable === true ? 'border-green-500' : usernameAvailable === false ? 'border-red-500' : 'border-border-dim focus:border-accent'
												}`}
												placeholder="coolplayer99"
												maxLength={20}
											/>
											<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs">
												{checkingUsername ? '…' : usernameAvailable === true ? '✓' : usernameAvailable === false ? '✗' : ''}
											</span>
										</div>
										{usernameAvailable === false && <p className="text-red-400 text-xs mt-1">Username taken</p>}
										{usernameAvailable === true && <p className="text-green-400 text-xs mt-1">Username available</p>}
									</div>
									<div>
										<label className="block text-text-dim text-xs mb-1 font-medium">Email</label>
										<input
											type="email" required autoComplete="email"
											value={email}
											onChange={e => this.setState({ email: e.target.value })}
											className="w-full bg-bg-panel border border-border-dim rounded-lg px-3 py-2.5 text-text-main text-sm focus:outline-none focus:border-accent transition-colors"
											placeholder="you@example.com"
										/>
									</div>
									<div>
										<label className="block text-text-dim text-xs mb-1 font-medium">Password</label>
										<input
											type="password" required autoComplete="new-password"
											value={password}
											onChange={e => this.setState({ password: e.target.value })}
											className="w-full bg-bg-panel border border-border-dim rounded-lg px-3 py-2.5 text-text-main text-sm focus:outline-none focus:border-accent transition-colors"
											placeholder="min 6 characters"
										/>
									</div>
									<div>
										<label className="block text-text-dim text-xs mb-1 font-medium">Confirm Password</label>
										<input
											type="password" required autoComplete="new-password"
											value={confirmPassword}
											onChange={e => this.setState({ confirmPassword: e.target.value })}
											className="w-full bg-bg-panel border border-border-dim rounded-lg px-3 py-2.5 text-text-main text-sm focus:outline-none focus:border-accent transition-colors"
											placeholder="••••••••"
										/>
									</div>
									<button
										type="submit" disabled={loading || usernameAvailable === false}
										className="w-full bg-accent hover:bg-orange-400 disabled:bg-bg-panel disabled:text-text-dim text-white font-semibold py-2.5 rounded-lg transition-colors"
									>
										{loading ? 'Creating account…' : 'Create Account'}
									</button>
								</form>
							)}

							<p className="text-center text-text-dim text-xs mt-4">
								{tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
								<button
									onClick={() => this.setState({ tab: tab === 'login' ? 'signup' : 'login', error: '' })}
									className="text-accent hover:underline"
								>
									{tab === 'login' ? 'Sign up' : 'Log in'}
								</button>
							</p>
						</div>
					</div>

					<p className="text-center text-text-dim text-xs mt-4">
						Starting rating: <span className="text-accent font-semibold">1500</span> · Rated by FIDE Elo rules
					</p>
				</div>
			</div>
		);
	}
}
