/*
  # Add Address Lookup Function Type Support

  1. Changes
    - Documents the addition of 'address_lookup' as a valid function_type value
    - address_lookup functions use AI to look up address components (postal code, city, province, etc.)
      based on multiple input fields

  2. Function Types Now Supported
    - 'conditional': IF/THEN logic with conditions and default value
    - 'date': Date calculation with source (field/current_date), operation (add/subtract), and days
    - 'address_lookup': AI-powered address field lookup using multiple input fields

  3. Address Lookup Function Logic Structure
    {
      "type": "address_lookup",
      "inputFields": ["shipper.address1", "shipper.city", "shipper.province"],
      "lookupType": "postal_code" | "city" | "province" | "country" | "full_address",
      "countryContext": "Canada" | "United States" | "Mexico" (optional)
    }
*/

COMMENT ON COLUMN field_mapping_functions.function_type IS 'Type of function: conditional (IF/THEN logic), date (date calculations), or address_lookup (AI-powered address field lookup)';