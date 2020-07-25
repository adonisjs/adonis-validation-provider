/*
 * @adonisjs/validator
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { DurationObjectUnits, DateTime } from 'luxon'
import { SyncValidation } from '@ioc:Adonis/Core/Validator'
import { wrapCompile, isRef, enforceDateTime } from '../../Validator/helpers'

const RULE_NAME = 'before'
const DEFAULT_MESSAGE = 'before date validation failed'

/**
 * Return type of the compile function
 */
type CompileReturnType = {
	offset?: { duration: keyof DurationObjectUnits; interval: number; hasDayDuration: boolean }
	ref?: string
}

/**
 * Ensure the value is one of the defined choices
 */
export const before: SyncValidation<CompileReturnType> = {
	compile: wrapCompile<CompileReturnType>(RULE_NAME, ['date'], ([interval, duration]) => {
		/**
		 * Choices are defined as a ref
		 */
		if (isRef(interval)) {
			return {
				compiledOptions: { ref: interval.key },
			}
		}

		/**
		 * Ensure value is an array or a ref
		 */
		if (!interval || !duration) {
			throw new Error(`"${RULE_NAME}": expects an offset "interval" and "duration" or a "ref"`)
		}

		/**
		 * Ensure interval is a valid number
		 */
		if (typeof interval !== 'number') {
			throw new Error(`"${RULE_NAME}": expects an "interval" to be a number`)
		}

		return {
			compiledOptions: {
				offset: { duration, interval, hasDayDuration: ['day', 'days'].includes(duration) },
			},
		}
	}),
	validate(value, compiledOptions, { errorReporter, pointer, arrayExpressionPointer, refs }) {
		let beforeDate: DateTime | unknown

		/**
		 * Do not run validation when original value is not a dateTime instance.
		 */
		if (value instanceof DateTime === false) {
			return
		}

		/**
		 * Resolve datetime to compare against
		 */
		if (compiledOptions.ref) {
			beforeDate = refs[compiledOptions.ref].value
		} else if (compiledOptions.offset) {
			beforeDate = DateTime.local().minus({
				[compiledOptions.offset.duration]: compiledOptions.offset.interval,
			})
		}

		enforceDateTime(beforeDate)

		/**
		 * In case of verifying days. We compare the diff without the time and here's why
		 *
		 * When someone says, they expect the date to before "2 days" from today, they mean
		 * 2 real days and not 48 hours and hence doing a time aware comparison will yield
		 * wrong results
		 */
		if (compiledOptions.offset && compiledOptions.offset.hasDayDuration) {
			if (value.startOf('day') >= beforeDate.startOf('day')) {
				errorReporter.report(pointer, RULE_NAME, DEFAULT_MESSAGE, arrayExpressionPointer, {
					before: beforeDate.toISO(),
				})
			}
			return
		}

		/**
		 * Validation
		 */
		if (value >= beforeDate) {
			errorReporter.report(pointer, RULE_NAME, DEFAULT_MESSAGE, arrayExpressionPointer, {
				before: beforeDate.toISO(),
			})
		}
	},
}