/*! CellEdit 1.0.19
 * ©2016 Elliott Beaty - datatables.net/license
 */

/**
 * @summary     CellEdit
 * @description Make a cell editable when clicked upon
 * @version     1.0.19
 * @file        dataTables.editCell.js
 * @author      Elliott Beaty
 * @contact     elliott@elliottbeaty.com
 * @copyright   Copyright 2016 Elliott Beaty
 *
 * This source file is free software, available under the following license:
 *   MIT license - http://datatables.net/license/mit
 *
 * This source file is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
 * or FITNESS FOR A PARTICULAR PURPOSE. See the license files for details.
 *
 * For details please refer to: http://www.datatables.net
 */

var _ = require('lodash');

jQuery.fn.dataTable.Api.register('MakeCellsEditable()', function (settings) {
    var table = this.table();

    jQuery.fn.extend({
        // UPDATE
        updateEditableCell: function (callingElement, convertBack) {
            // Need to redeclare table here for situations where we have more than one datatable on the page. See issue6 on github
            var table = $(callingElement).closest("table").DataTable().table();
            var row = table.row($(callingElement).parents('tr'));
            var cell = table.cell($(callingElement).parent());
            var columnIndex = cell.index().column;
            var inputField =getInputField(callingElement);

            // Update
            var newValue = inputField.val();

            if(_.isFunction(convertBack)){
                newValue = convertBack(newValue)
            }

            if (!newValue && ((settings.allowNulls) && settings.allowNulls != true)) {
                // If columns specified
                if (settings.allowNulls.columns) {
                    // If current column allows nulls
                    if (settings.allowNulls.columns.indexOf(columnIndex) > -1) {
                        _update(newValue);
                    } else {
                        _addValidationCss();
                    }
                    // No columns allow null
                } else if (!newValue) {
                    _addValidationCss();
                }
                //All columns allow null
            } else {
                _update(newValue);
            }
            function _addValidationCss() {
                // Show validation error
                if (settings.allowNulls.errorClass) {
                    $(inputField).addClass(settings.allowNulls.errorClass)
                } else {
                    $(inputField).css({ "border": "red solid 1px" });
                }
            }
            function _update(newValue) {
                var oldValue = cell.data();
                cell.data(newValue);
                //Return cell & row.
                settings.onUpdate(cell, row, oldValue);
            }
            // Get current page
            var currentPageIndex = table.page.info().page;

            //Redraw table
            table.page(currentPageIndex).draw(false);
        },
        // CANCEL
        cancelEditableCell: function (callingElement) {
            var table = $(callingElement.closest("table")).DataTable().table();
            var cell = table.cell($(callingElement).parent());
            // Set cell to it's original value
            cell.data(cell.data());

            // Redraw table
            table.draw();
        }
    });

    // Destroy
    if (settings === "destroy") {
        $(table.body()).off("click", "td");
        table = null;
    }

    if (table != null) {
        // On cell click
        $(table.body()).on('click', 'td', function () {

            var currentColumnIndex = table.cell(this).index().column;

            // DETERMINE WHAT COLUMNS CAN BE EDITED
            if ((settings.columns && settings.columns.indexOf(currentColumnIndex) > -1) || (!settings.columns)) {
                var row = table.row($(this).parents('tr'));
                editableCellsRow = row;

                var cell = table.cell(this).node();
                var oldValue = table.cell(this).data();
                // Sanitize value
                oldValue = sanitizeCellValue(oldValue);

                // Show input
                if (!$(cell).find('input').length && !$(cell).find('select').length && !$(cell).find('textarea').length) {
                    // Input CSS
                    var input = getInputHtml(currentColumnIndex, settings, oldValue);
                    $(cell).html(input.html);
                    if (input.focus) {
                        $('#ejbeatycelledit').focus();
                    }
                }
            }
        });
    }

});

function getInputHtml(currentColumnIndex, settings, oldValue) {
    var inputSetting, inputType, input, inputCss, selectCss, confirmCss, cancelCss, convertBack;

    input = {"focus":true,"html":null}

    if(settings.inputTypes){
		$.each(settings.inputTypes, function (index, setting) {
			if (setting.column == currentColumnIndex) {
				inputSetting = setting;
				inputType = inputSetting.type.toLowerCase();
			}
		});
    }
    
    convertback = inputSetting.convertback
    if(_.isFunction(inputSetting.convert)) {
        oldValue = inputSetting.convert(oldValue)
    }

    if (settings.inputCss) { inputCss = settings.inputCss; }
    if (settings.selectCss) { selectCss = settings.selectCss; }
    if (settings.confirmationButton) {
        confirmCss = settings.confirmationButton.confirmCss;
        cancelCss = settings.confirmationButton.cancelCss;
        inputType = inputType + "-confirm";
    }
    switch (inputType) {
        case "list":
            input.html = "<select class='" + selectCss + "' onchange='$(this).updateEditableCell(this);'>";
            $.each(inputSetting.options, function (index, option) {
                if (oldValue == option.value) {
                   input.html = input.html + "<option value='" + option.value + "' selected>" + option.display + "</option>"
                } else {
                   input.html = input.html + "<option value='" + option.value + "' >" + option.display + "</option>"
                }
            });
            input.html = input.html + "</select>";
            input.focus = false;
            break;
        case "datepicker": //Both datepicker options work best when confirming the values
            
	        input.html = "<input id='ejbeatycelledit' type='text' name='date' class='datepick " + inputCss + "'   value='" + oldValue + "'></input>";
	        setTimeout(function () { //Set timeout to allow the script to write the input.html before triggering the datepicker
	            var datepickerObj = jQuery('.datepick').datepicker({
                    language: 'de',
                    autoClose: true,
                    todayButton: false,
                    dateFormat: 'yyyy-mm-dd',
                    onSelect:function onSelect(fd, date,picker) {
                        $(this).updateEditableCell(picker.el);
                    }.bind(this)
                }).data('datepicker')
                datepickerObj.show()
	        },100);
	        break;
        
        case "duration":
            input.html = "<input id='ejbeatycelledit' class='" + inputCss + "' onfocusout='$(this).updateEditableCell(this,convertback)' onkeydown='if (event.keyCode == 13) { $(this).updateEditableCell(this,convertback) }' value='" + oldValue + "'></input>";
            break;
        case "none":
            break;
        default: // text input
            input.html = "<input id='ejbeatycelledit' class='" + inputCss + "' onfocusout='$(this).updateEditableCell(this,convertback)' onkeydown='if (event.keyCode == 13) { $(this).updateEditableCell(this,convertback) }' value='" + oldValue + "'></input>";
            break;
    }
    return input;
}

function getInputField(callingElement) {
    // Update datatables cell value
    var inputField;
    switch ($(callingElement).prop('nodeName').toLowerCase()) {
        case 'a': // This means they're using confirmation buttons
            if ($(callingElement).siblings('input').length > 0) {
                inputField = $(callingElement).siblings('input');
            }
            if ($(callingElement).siblings('select').length > 0) {
                inputField = $(callingElement).siblings('select');
            }
            if ($(callingElement).siblings('textarea').length > 0) {
                inputField = $(callingElement).siblings('textarea');
            }
        break;
        default:
            inputField = $(callingElement);
    }
    return inputField;
}

function sanitizeCellValue(cellValue) {
    if (typeof (cellValue) === 'undefined' || cellValue === null || cellValue.length < 1) {
        return "";
    }

    // If not a number
    if (isNaN(cellValue)) {
        // escape single quote
        cellValue = cellValue.replace(/'/g, "&#39;");
    }
    return cellValue;
}