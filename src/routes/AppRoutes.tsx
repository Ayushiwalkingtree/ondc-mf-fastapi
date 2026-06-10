import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import CatalogueSearch from '../pages/CatalogueSearch/CatalogueSearch';
import Onboarding from '../pages/Onboarding/Onboarding';
import OrderTracking from '../pages/OrderTracking/OrderTracking';
import ReviewConfirm from '../pages/ReviewConfirm/ReviewConfirm';
import TransactionSetup from '../pages/TransactionSetup/TransactionSetup';

const AppRoutes = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route index element={<Navigate to="/onboarding" replace />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/catalogue" element={<CatalogueSearch />} />
      <Route path="/transaction-setup" element={<TransactionSetup />} />
      <Route path="/transaction" element={<Navigate to="/transaction-setup" replace />} />
      <Route path="/review" element={<ReviewConfirm />} />
      <Route path="/tracking" element={<OrderTracking />} />
    </Route>
    <Route path="*" element={<Navigate to="/onboarding" replace />} />
  </Routes>
);

export default AppRoutes;
