import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app

class AdapterTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    @patch.dict('os.environ', {'AI_PROVIDER_KEY': '', 'AI_MODEL': ''})
    def test_missing_provider_is_explicit(self):
        self.assertFalse(self.client.get('/health').json()['providerConfigured'])
        response = self.client.post('/analyze/resume', json={'text': 'A resume', 'target': 'Engineer'})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('summary', response.json())

    def test_payload_limits(self):
        self.assertEqual(self.client.post('/analyze/resume', json={'text': 'x'*20001, 'target': 'Engineer'}).status_code, 422)
        self.assertEqual(self.client.post('/analyze/interview', json={'text': '', 'target': 'Engineer'}).status_code, 422)

    def test_unknown_operation(self):
        self.assertEqual(self.client.post('/analyze/unknown', json={'text': 'Text', 'target': 'Role'}).status_code, 422)

if __name__ == '__main__':
    unittest.main()
