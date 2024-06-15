import React from "react";
import { Route, Routes, Link } from "react-router-dom";
import { Button } from '@arco-design/mobile-react';
import Arco from '@arco-design/mobile-react';
import '@arco-design/mobile-react/esm/style';
import Home from './pages/home';
import Login from './pages/login';
import SpeechApp from './pages/speechapp';
import './custom.css';

export default function App() {
	return (
		<div className="main-container">
			<nav>
				<ul>
					<li>
						<Link to="/">Home</Link>
					</li>
					<li>
						<Link to="/speech">Speech App</Link>
					</li>
				</ul>
			</nav>
			<Button type="primary">Arco Design Button</Button>
			<Routes>
				<Route path="/" element={<Home />} />
				<Route path="/login" element={<Login />} />
				<Route path="/speech" element={<SpeechApp />} />
			</Routes>
		</div>
	);
}