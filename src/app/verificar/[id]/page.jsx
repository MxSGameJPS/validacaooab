import VerificationFlow from "./VerificationFlow";

export default async function VerificarPage({ params }) {
  const { id } = await params;
  return <VerificationFlow sessaoId={id} />;
}
