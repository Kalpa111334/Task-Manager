import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Task } from '../../types';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../utils/currency';
import {
  CurrencyDollarIcon,
  UserIcon,
  ClockIcon,
  CalendarIcon,
} from '@heroicons/react/outline';

// ... existing code ...

<div className="flex items-center">
  <CurrencyDollarIcon className="h-4 w-4 mr-1" />
  {formatCurrency(task.price)}
</div>

// ... existing code ... 