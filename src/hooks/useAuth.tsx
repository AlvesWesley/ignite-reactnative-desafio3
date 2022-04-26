import { makeRedirectUri, revokeAsync, startAsync } from "expo-auth-session";
import React, {
  useEffect,
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";
import { generateRandom } from "expo-auth-session/build/PKCE";

import { api } from "../services/api";

interface User {
  id: number;
  display_name: string;
  email: string;
  profile_image_url: string;
}

interface AuthContextData {
  user: User;
  isLoggingOut: boolean;
  isLoggingIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface AuthProviderData {
  children: ReactNode;
}

const AuthContext = createContext({} as AuthContextData);

const twitchEndpoints = {
  authorization: "https://id.twitch.tv/oauth2/authorize",
  revocation: "https://id.twitch.tv/oauth2/revoke",
};

function AuthProvider({ children }: AuthProviderData) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState({} as User);
  const [userToken, setUserToken] = useState("");

  const { CLIENT_ID: clientId } = process.env;

  async function signIn() {
    try {
      setIsLoggingIn(true);
      const redirectUri = makeRedirectUri({ useProxy: true });
      const response_type = "token";
      const scope = "openid user:read:email user:read:follows";
      const force_verify = true;
      const state = generateRandom(30);
      const authUrl = encodeURI(
        twitchEndpoints.authorization +
          `?client_id=${clientId}` +
          `&redirect_uri=${redirectUri}` +
          `&response_type=${response_type}` +
          `&scope=${scope}` +
          `&force_verify=${force_verify}` +
          `&state=${state}`
      );
      const authResponse = await startAsync({ authUrl });

      if (
        authResponse.type === "success" &&
        authResponse.params.error !== "access_denied"
      ) {
        if (authResponse.params.state !== state) {
          throw new Error("Invalid state value");
        }

        api.defaults.headers.authorization = `Bearer ${authResponse.params.access_token}`;
        const userResponse = await api.get("/users");
        setUser(userResponse.data.data[0]);
        setUserToken(authResponse.params.access_token);
      }
    } catch (error) {
      throw new Error();
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function signOut() {
    try {
      setIsLoggingOut(true);
      await revokeAsync(
        {
          token: userToken,
          clientId: clientId,
        },
        { revocationEndpoint: twitchEndpoints.revocation }
      );
    } catch (error) {
    } finally {
      setUser({} as User);
      setUserToken("");
      api.defaults.headers.authorization = "";
      setIsLoggingOut(false);
    }
  }

  useEffect(() => {
    api.defaults.headers["Client-Id"] = clientId;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoggingOut, isLoggingIn, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = useContext(AuthContext);

  return context;
}

export { AuthProvider, useAuth };
