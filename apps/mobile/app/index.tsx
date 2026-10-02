import { Redirect } from 'expo-router';
import { authService } from '@shared';

export default function Index() {
  return <Redirect href={authService.isAuthenticated() ? '/activities' : '/login'} />;
}
