import { AppProvider, useApp } from './state/app-context';
import { LoginScreen } from './screens/LoginScreen';
import { ShiftOpenScreen } from './screens/ShiftOpenScreen';
import { SaleScreen } from './screens/SaleScreen';
import { PaymentScreen } from './screens/PaymentScreen';
import { SaleCompleteScreen } from './screens/SaleCompleteScreen';
import { SalesTodayScreen } from './screens/SalesTodayScreen';
import { ReturnsScreen } from './screens/ReturnsScreen';
import { CashMovementScreen } from './screens/CashMovementScreen';
import { ShiftCloseScreen } from './screens/ShiftCloseScreen';
import { CreditCustomersScreen } from './screens/CreditCustomersScreen';

function Screens() {
  const { state } = useApp();

  if (state.booting) {
    return <div className="h-full flex items-center justify-center text-text/50">Yuklanmoqda...</div>;
  }

  switch (state.screen) {
    case 'login':
      return <LoginScreen />;
    case 'shiftOpen':
      return <ShiftOpenScreen />;
    case 'sale':
      return <SaleScreen />;
    case 'payment':
      return <PaymentScreen />;
    case 'saleComplete':
      return <SaleCompleteScreen />;
    case 'salesToday':
      return <SalesTodayScreen />;
    case 'returns':
      return <ReturnsScreen />;
    case 'cashMovement':
      return <CashMovementScreen />;
    case 'shiftClose':
      return <ShiftCloseScreen />;
    case 'creditCustomers':
      return <CreditCustomersScreen />;
    default:
      return null;
  }
}

export function App() {
  return (
    <AppProvider>
      <Screens />
    </AppProvider>
  );
}

export default App;
