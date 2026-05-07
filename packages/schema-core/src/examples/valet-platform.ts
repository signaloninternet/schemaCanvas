export const valetPlatformSql = `CREATE TYPE ticket_status AS ENUM ('active', 'requested', 'ready', 'completed', 'cancelled');

CREATE TABLE locations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE vehicles (
  id UUID PRIMARY KEY,
  owner_name TEXT NOT NULL,
  plate_number TEXT UNIQUE NOT NULL,
  color TEXT,
  make TEXT,
  model TEXT,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE parking_spots (
  id UUID PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES locations(id),
  code TEXT NOT NULL,
  level TEXT,
  status TEXT NOT NULL DEFAULT 'available'
);

CREATE TABLE shifts (
  id UUID PRIMARY KEY,
  location_id UUID NOT NULL REFERENCES locations(id),
  attendant_name TEXT NOT NULL,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP
);

CREATE TABLE tickets (
  id UUID PRIMARY KEY,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id),
  location_id UUID NOT NULL REFERENCES locations(id),
  shift_id UUID REFERENCES shifts(id),
  spot_id UUID REFERENCES parking_spots(id),
  status ticket_status NOT NULL DEFAULT 'active',
  requested_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES tickets(id),
  subtotal NUMERIC(10,2) NOT NULL,
  tax NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE payments (
  id UUID PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES invoices(id),
  amount NUMERIC(10,2) NOT NULL,
  provider TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);`;
