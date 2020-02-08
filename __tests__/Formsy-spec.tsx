import { mount } from 'enzyme';
import * as React from 'react';
import DynamicInputForm from '../__test_utils__/DynamicInputForm';
import TestInput from '../__test_utils__/TestInput';
import TestInputHoc from '../__test_utils__/TestInputHoc';

import Formsy, { addValidationRule } from '../src';

describe('Setting up a form', () => {
  it('should expose the users DOM node through an innerRef prop', () => {
    class TestForm extends React.Component {
      render() {
        return (
          <Formsy>
            <TestInputHoc
              name="name"
              innerRef={c => {
                this.inputRef = c;
              }}
            />
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);
    const input = form.instance().inputRef;
    expect(input.props.name).toEqual('name');
  });

  it('should render a form into the document', () => {
    const form = mount(<Formsy></Formsy>);
    expect(form.find('form').name()).toEqual('form');
  });

  it('should set a class name if passed', () => {
    const form = mount(<Formsy className="foo"></Formsy>);
    expect(form.find('form').hasClass('foo')).toBe(true);
  });

  it('should allow for null/undefined children', () => {
    let model = null;

    class TestForm extends React.Component {
      render() {
        return (
          <Formsy onSubmit={formModel => (model = formModel)}>
            <h1>Test</h1>
            {null}
            {undefined}
            <TestInput name="name" value="foo" />
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);
    form.simulate('submit');
    expect(model).toEqual({ name: 'foo' });
  });

  it('should allow for inputs being added dynamically', () => {
    let model = null;

    const form = mount(<DynamicInputForm onSubmit={formModel => (model = formModel)} inputName="test" />);
    form.find('button').simulate('click');
    form.update();

    form.simulate('submit');
    expect(model).toHaveProperty('test');
  });

  it('should allow dynamically added inputs to update the form-model', () => {
    let model = null;

    const form = mount(<DynamicInputForm onSubmit={formModel => (model = formModel)} inputName="test" />);
    form.find('button').simulate('click');
    form.update();

    form.find('input').simulate('change', {
      target: { value: 'foo' },
    });
    form.simulate('submit');
    expect(model).toHaveProperty('test', 'foo');
  });

  it('should allow a dynamically updated input to update the form-model', () => {
    let model = null;

    class TestForm extends React.Component<any> {
      public state = {
        inputValue: this.props.inputValue,
      };

      render() {
        const { inputValue } = this.state;
        return (
          <Formsy onSubmit={formModel => (model = formModel)}>
            <TestInput name="test" value={inputValue} />
            <button type="button" onClick={this.updateInputValue} />
          </Formsy>
        );
      }

      updateInputValue = () => this.setState({ inputValue: 'bar' });
    }

    const form = mount(<TestForm inputValue="foo" />);

    form.simulate('submit');

    expect(model).toHaveProperty('test', 'foo');

    form.find('button').simulate('click');
    form.update();
    form.simulate('submit');
    form.update();

    expect(model).toHaveProperty('test', 'bar');
  });
});

describe('mapModel', () => {
  it('should honor mapModel transformations', () => {
    const mapping = jest.fn(model => ({
      ...model,
      testChange: true,
    }));
    const onSubmit = jest.fn();

    function TestForm() {
      return (
        <Formsy mapping={mapping} onSubmit={onSubmit}>
          <TestInput name="parent.child" value="test" />
        </Formsy>
      );
    }

    const form = mount(<TestForm />);

    form.simulate('submit');
    expect(mapping).toHaveBeenCalledWith({ 'parent.child': 'test' });
    expect(onSubmit).toHaveBeenCalledWith(
      { 'parent.child': 'test', testChange: true },
      expect.any(Function),
      expect.any(Function),
    );
  });
});

describe('validations', () => {
  it('should run when the input changes', () => {
    const runRule = jest.fn();
    const notRunRule = jest.fn();

    addValidationRule('runRule', runRule);
    addValidationRule('notRunRule', notRunRule);

    const form = mount(
      <Formsy>
        <TestInput name="one" validations="runRule" value="foo" />
      </Formsy>,
    );

    const input = form.find('input');
    input.simulate('change', {
      target: { value: 'bar' },
    });

    expect(runRule).toHaveBeenCalledWith({ one: 'bar' }, 'bar', true);
    expect(notRunRule).not.toHaveBeenCalled();
  });

  it('should allow the validation to be changed', () => {
    const ruleA = jest.fn();
    const ruleB = jest.fn();
    addValidationRule('ruleA', ruleA);
    addValidationRule('ruleB', ruleB);

    class TestForm extends React.Component {
      constructor(props) {
        super(props);
        this.state = { rule: 'ruleA' };
      }

      changeRule = () => {
        this.setState({
          rule: 'ruleB',
        });
      };

      render() {
        return (
          <Formsy>
            <TestInput name="one" validations={this.state.rule} value="foo" />
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);
    form.instance().changeRule();
    const input = form.find('input');
    input.simulate('change', {
      target: { value: 'bar' },
    });
    expect(ruleB).toHaveBeenCalledWith({ one: 'bar' }, 'bar', true);
  });

  it('should invalidate a form if dynamically inserted input is invalid', () => {
    const isInValidSpy = jest.fn();

    class TestForm extends React.Component {
      formRef = React.createRef();

      constructor(props) {
        super(props);
        this.state = { showSecondInput: false };
      }

      addInput = () => {
        this.setState({
          showSecondInput: true,
        });
      };

      render() {
        return (
          <Formsy ref={this.formRef} onInvalid={isInValidSpy}>
            <TestInput name="one" validations="isEmail" value="foo@bar.com" />
            {this.state.showSecondInput ? <TestInput name="two" validations="isEmail" value="foo@bar" /> : null}
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);

    expect(form.instance().formRef.current.state.isValid).toEqual(true);
    form.instance().addInput();

    expect(isInValidSpy).toHaveBeenCalled();
  });

  it('should validate a form when removing an invalid input', () => {
    const isValidSpy = jest.fn();

    class TestForm extends React.Component {
      formRef = React.createRef();

      constructor(props) {
        super(props);
        this.state = { showSecondInput: true };
      }

      removeInput() {
        this.setState({
          showSecondInput: false,
        });
      }

      render() {
        return (
          <Formsy ref={this.formRef} onValid={isValidSpy}>
            <TestInput name="one" validations="isEmail" value="foo@bar.com" />
            {this.state.showSecondInput ? <TestInput name="two" validations="isEmail" value="foo@bar" /> : null}
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);

    expect(form.instance().formRef.current.state.isValid).toEqual(false);
    form.instance().removeInput();

    expect(isValidSpy).toHaveBeenCalled();
  });

  it('runs multiple validations', () => {
    const ruleA = jest.fn();
    const ruleB = jest.fn();
    addValidationRule('ruleA', ruleA);
    addValidationRule('ruleB', ruleB);

    const form = mount(
      <Formsy>
        <TestInput name="one" validations="ruleA,ruleB" value="foo" />
      </Formsy>,
    );

    const input = form.find('input');
    input.simulate('change', {
      target: { value: 'bar' },
    });
    expect(ruleA).toHaveBeenCalledWith({ one: 'bar' }, 'bar', true);
    expect(ruleB).toHaveBeenCalledWith({ one: 'bar' }, 'bar', true);
  });
});

describe('onChange', () => {
  it('should not trigger onChange when form is mounted', () => {
    const hasChanged = jest.fn();

    class TestForm extends React.Component {
      render() {
        return <Formsy onChange={hasChanged}></Formsy>;
      }
    }

    mount(<TestForm />);
    expect(hasChanged).not.toHaveBeenCalled();
  });

  it('should trigger onChange once when form element is changed', () => {
    const hasChanged = jest.fn();
    const form = mount(
      <Formsy onChange={hasChanged}>
        <TestInput name="foo" value="" />
      </Formsy>,
    );
    form.find('input').simulate('change', { target: { value: 'bar' } });
    expect(hasChanged).toHaveBeenCalledTimes(1);
  });

  it('should trigger onChange once when new input is added to form', () => {
    const hasChanged = jest.fn();

    class TestForm extends React.Component {
      state = {
        showInput: false,
      };

      addInput() {
        this.setState({
          showInput: true,
        });
      }

      render() {
        return <Formsy onChange={hasChanged}>{this.state.showInput ? <TestInput name="test" /> : null}</Formsy>;
      }
    }

    const form = mount(<TestForm />);
    form.instance().addInput();
    expect(hasChanged).toHaveBeenCalledTimes(1);
  });

  it('onChange should honor dot notation transformations', () => {
    const hasChanged = jest.fn();

    class TestForm extends React.Component {
      state = {
        showInput: false,
      };

      addInput() {
        this.setState({
          showInput: true,
        });
      }

      render() {
        return (
          <Formsy onChange={hasChanged}>
            {this.state.showInput ? <TestInput name="parent.child" value="test" /> : null}
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);
    form.instance().addInput();
    form.update();

    expect(hasChanged).toHaveBeenCalledWith({ parent: { child: 'test' } }, false);
  });
});

describe('Update a form', () => {
  it('should allow elements to check if the form is disabled', () => {
    class TestForm extends React.Component {
      state = { disabled: true };

      enableForm() {
        this.setState({ disabled: false });
      }

      render() {
        return (
          <Formsy disabled={this.state.disabled}>
            <TestInput name="foo" />
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);
    const input = form.find(TestInput);
    expect(input.instance().isFormDisabled()).toEqual(true);

    form.instance().enableForm();

    expect(input.instance().isFormDisabled()).toEqual(false);
  });

  it('should be possible to pass error state of elements by changing an errors attribute', () => {
    class TestForm extends React.Component {
      state = { validationErrors: { foo: 'bar' } };
      onChange = values => {
        this.setState(values.foo ? { validationErrors: {} } : { validationErrors: { foo: 'bar' } });
      };

      render() {
        return (
          <Formsy onChange={this.onChange} validationErrors={this.state.validationErrors}>
            <TestInput name="foo" value="" />
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);

    const input = form.find(TestInput);
    expect(input.instance().getErrorMessage()).toEqual('bar');
    input.instance().setValue('gotValue');

    expect(input.instance().getErrorMessage()).toEqual(null);
  });

  it('should trigger an onValidSubmit when submitting a valid form', () => {
    const isCalled = jest.fn();

    class TestForm extends React.Component {
      render() {
        return (
          <Formsy onValidSubmit={isCalled}>
            <TestInput name="foo" validations="isEmail" value="foo@bar.com" />
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);
    const FoundForm = form.find(TestForm);
    FoundForm.simulate('submit');
    expect(isCalled).toHaveBeenCalled();
  });

  it('should trigger an onInvalidSubmit when submitting an invalid form', () => {
    const isCalled = jest.fn();

    class TestForm extends React.Component {
      render() {
        return (
          <Formsy onInvalidSubmit={isCalled}>
            <TestInput name="foo" validations="isEmail" value="foo@bar" />
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);

    const FoundForm = form.find(TestForm);
    FoundForm.simulate('submit');
    expect(isCalled).toHaveBeenCalled();
  });
});

describe('value === false', () => {
  it('should call onSubmit correctly', () => {
    const onSubmit = jest.fn();

    class TestForm extends React.Component {
      render() {
        return (
          <Formsy onSubmit={onSubmit}>
            <TestInput name="foo" value={false} type="checkbox" />
            <button type="submit">Save</button>
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);
    form.simulate('submit');
    expect(onSubmit).toHaveBeenCalledWith({ foo: false }, expect.any(Function), expect.any(Function));
  });

  it('should allow dynamic changes to false', () => {
    const onSubmit = jest.fn();

    class TestForm extends React.Component {
      state = {
        value: true,
      };

      changeValue() {
        this.setState({
          value: false,
        });
      }

      render() {
        return (
          <Formsy onSubmit={onSubmit}>
            <TestInput name="foo" value={this.state.value} type="checkbox" />
            <button type="submit">Save</button>
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);
    form.instance().changeValue();
    form.simulate('submit');
    expect(onSubmit).toHaveBeenCalledWith({ foo: false }, expect.any(Function), expect.any(Function));
  });

  it('should say the form is submitted', () => {
    class TestForm extends React.Component {
      render() {
        return (
          <Formsy>
            <TestInput name="foo" value={true} type="checkbox" />
            <button type="submit">Save</button>
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);
    const input = form.find(TestInput);
    expect(input.instance().isFormSubmitted()).toEqual(false);
    form.simulate('submit');
    expect(input.instance().isFormSubmitted()).toEqual(true);
  });

  it('should be able to reset the form to its pristine state', () => {
    class TestForm extends React.Component {
      state = {
        value: true,
      };

      changeValue() {
        this.setState({
          value: false,
        });
      }

      render() {
        return (
          <Formsy>
            <TestInput name="foo" value={this.state.value} type="checkbox" />
            <button type="submit">Save</button>
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);
    const input = form.find(TestInput);
    const formsyForm = form.find(Formsy);
    expect(input.instance().getValue()).toEqual(true);
    form.instance().changeValue();
    expect(input.instance().getValue()).toEqual(false);
    formsyForm.instance().reset();
    expect(input.instance().getValue()).toEqual(true);
  });

  it('should be able to set a value to components with updateInputsWithValue', () => {
    class TestForm extends React.Component {
      state = {
        valueFoo: true,
        valueBar: true,
      };

      render() {
        return (
          <Formsy>
            <TestInput name="foo" value={this.state.valueFoo} type="checkbox" />
            <TestInput name="bar" value={this.state.valueBar} type="checkbox" />
            <button type="submit">Save</button>
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);
    const inputs = form.find(TestInput);
    const formsyForm = form.find(Formsy);
    expect(
      inputs
        .at(0)
        .instance()
        .getValue(),
    ).toEqual(true);
    expect(
      inputs
        .at(1)
        .instance()
        .getValue(),
    ).toEqual(true);
    formsyForm.instance().updateInputsWithValue({ foo: false });
    expect(
      inputs
        .at(0)
        .instance()
        .getValue(),
    ).toEqual(false);
    expect(
      inputs
        .at(1)
        .instance()
        .getValue(),
    ).toEqual(true);
  });

  it('should be able to reset the form using custom data', () => {
    class TestForm extends React.Component {
      state = {
        value: true,
      };

      changeValue() {
        this.setState({
          value: false,
        });
      }

      render() {
        return (
          <Formsy>
            <TestInput name="foo" value={this.state.value} type="checkbox" />
            <button type="submit">Save</button>
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);
    const input = form.find(TestInput);
    const formsyForm = form.find(Formsy);

    expect(input.instance().getValue()).toEqual(true);
    form.instance().changeValue();
    expect(input.instance().getValue()).toEqual(false);
    formsyForm.instance().reset({
      foo: 'bar',
    });
    expect(input.instance().getValue()).toEqual('bar');
  });
});

describe('.reset()', () => {
  it('should be able to reset the form to empty values', () => {
    class TestForm extends React.Component {
      render() {
        return (
          <Formsy>
            <TestInput name="foo" value="42" type="checkbox" />
            <button type="submit">Save</button>
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);
    const input = form.find(TestInput);
    const formsyForm = form.find(Formsy);

    formsyForm.instance().reset({
      foo: '',
    });
    expect(input.instance().getValue()).toEqual('');
  });

  it('should be able to reset the form using a button', () => {
    function TestForm() {
      return (
        <Formsy>
          <TestInput name="foo" value="foo" />
          <button type="submit">Save</button>
        </Formsy>
      );
    }

    const form = mount(<TestForm />);
    const input = form.find(TestInput);
    const formsyForm = form.find(Formsy);

    expect(input.instance().getValue()).toEqual('foo');
    input.simulate('change', { target: { value: 'foobar' } });
    expect(input.instance().getValue()).toEqual('foobar');
    formsyForm.simulate('reset');
    expect(input.instance().getValue()).toEqual('foo');
  });
});

describe('.isChanged()', () => {
  it('initially returns false', () => {
    const hasOnChanged = jest.fn();
    const form = mount(
      <Formsy onChange={hasOnChanged}>
        <TestInput name="one" value="foo" />
      </Formsy>,
    );
    expect(form.instance().isChanged()).toEqual(false);
    expect(hasOnChanged).not.toHaveBeenCalled();
  });

  it('returns true when changed', () => {
    const hasOnChanged = jest.fn();
    const form = mount(
      <Formsy onChange={hasOnChanged}>
        <TestInput name="one" value="foo" />
      </Formsy>,
    );
    const input = form.find('input');
    input.simulate('change', {
      target: { value: 'bar' },
    });
    expect(form.instance().isChanged()).toEqual(true);
    expect(hasOnChanged).toHaveBeenCalledWith({ one: 'bar' }, true);
  });

  it('returns false if changes are undone', () => {
    const hasOnChanged = jest.fn();
    const form = mount(
      <Formsy onChange={hasOnChanged}>
        <TestInput name="one" value="foo" />
      </Formsy>,
    );
    const input = form.find('input');
    input.simulate('change', {
      target: { value: 'bar' },
    });
    expect(hasOnChanged).toHaveBeenCalledWith({ one: 'bar' }, true);

    input.simulate('change', {
      target: { value: 'foo' },
    });

    expect(form.instance().isChanged()).toEqual(false);
    expect(hasOnChanged).toHaveBeenCalledWith({ one: 'foo' }, false);
  });
});

describe('form valid state', () => {
  it('should allow to be changed with updateInputsWithError', () => {
    let isValid = true;

    class TestForm extends React.Component {
      onValidSubmit = (model, reset, updateInputsWithError) => {
        updateInputsWithError({ foo: 'bar' }, true);
      };
      onValid = () => {
        isValid = true;
      };
      onInvalid = () => {
        isValid = false;
      };

      render() {
        return (
          <Formsy onInvalid={this.onInvalid} onValid={this.onValid} onValidSubmit={this.onValidSubmit}>
            <TestInput name="foo" />
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);

    expect(isValid).toEqual(true);
    form.simulate('submit');

    expect(isValid).toEqual(false);
  });

  it('should throw an error when updateInputsWithError is called with a missing input', () => {
    const mockConsoleError = jest.spyOn(console, 'error');
    mockConsoleError.mockImplementation(() => {
      // do nothing
    });

    class TestForm extends React.Component {
      onValidSubmit = (model, reset, updateInputsWithError) => {
        updateInputsWithError({ bar: 'bar' }, true);
      };

      render() {
        return (
          <Formsy onValidSubmit={this.onValidSubmit}>
            <TestInput name="foo" />
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);
    expect(() => form.simulate('submit')).toThrow();
    mockConsoleError.mockRestore();
  });

  it('should be false when validationErrors is not empty', () => {
    let isValid = true;

    class TestForm extends React.Component {
      state = { validationErrors: {} };
      setValidationErrors = empty => {
        this.setState(!empty ? { validationErrors: { foo: 'bar' } } : { validationErrors: {} });
      };
      onValid = () => {
        isValid = true;
      };
      onInvalid = () => {
        isValid = false;
      };

      render() {
        return (
          <Formsy onInvalid={this.onInvalid} onValid={this.onValid} validationErrors={this.state.validationErrors}>
            <TestInput name="foo" />
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);

    expect(isValid).toEqual(true);
    form.instance().setValidationErrors();

    expect(isValid).toEqual(false);
  });

  it('should be true when validationErrors is not empty and preventExternalInvalidation is true', () => {
    let isValid = true;
    class TestForm extends React.Component {
      state = { validationErrors: {} };
      setValidationErrors = empty => {
        this.setState(!empty ? { validationErrors: { foo: 'bar' } } : { validationErrors: {} });
      };
      onValid = () => {
        isValid = true;
      };
      onInvalid = () => {
        isValid = false;
      };

      render() {
        return (
          <Formsy
            onInvalid={this.onInvalid}
            onValid={this.onValid}
            preventExternalInvalidation
            validationErrors={this.state.validationErrors}
          >
            <TestInput name="foo" />
          </Formsy>
        );
      }
    }

    const form = mount(<TestForm />);

    expect(isValid).toEqual(true);
    form.instance().setValidationErrors();

    expect(isValid).toEqual(true);
  });
});
