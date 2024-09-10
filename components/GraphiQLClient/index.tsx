'use client';

import React, { useMemo } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Button, Tab, Tabs } from '@mui/material';
import { Box } from '@mui/system';
import CustomTabPanel from '@/components/RestClient/Form/CustomTabPanel';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { selectAll, setQuery } from '@/redux/features/graphiqlClient/graphiqlSlice';
import { setResponse } from '@/redux/features/mainSlice';
import { useRouter } from 'next/navigation';
import { GraphiQLProvider, QueryEditor } from '@graphiql/react';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import GraphiqlHeader from '@/components/GraphiQLClient/GraphiqlHeader';
import Documentation from '@/components/GraphiQLClient/Documentation';
import PrettifyButton from '@/components/GraphiQLClient/PrettifyButton';
import VariablesSection from '@/components/GraphiQLClient/VariablesSection';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { routes } from '@/constants/routes';
import { useForm } from 'react-hook-form';
import { UrlGraphql } from '@/interfaces/url-graphql.interfase';
import { yupResolver } from '@hookform/resolvers/yup';
import { urlValidationSchema } from '@/validation/url-graphql.validation';
import UrlSection from '@/components/GraphiQLClient/UrlSection';
import { toast } from 'sonner';
import { toastMessages } from '@/constants/toastMessages';
import { fetcher } from '@/services/response';

const GraphiQLClient = () => {
  const { query, variables, url, headers } = useAppSelector(selectAll);
  const gqlFetcher = useMemo(() => createGraphiQLFetcher({ url }), [url]);
  const [value, setValue] = React.useState(0);
  const router = useRouter();
  const dispatch = useAppDispatch();

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  const executeQuery = async () => {
    const lines = query.split('\n');
    const filteredLines = lines.filter((line) => !line.trim().startsWith('#'));
    const filteredQuery = filteredLines.join('\n');
    const requestHeaders = Object.fromEntries(headers.map((header) => [header.key, header.value]).reverse());
    console.log(requestHeaders);

    const reqHeaders = headers
      ? requestHeaders
      : {
          'Content-Type': 'application/json',
        };

    try {
      const [queryType] = filteredQuery.match(/(query|mutation|subscription)/) || [''];
      const [_, operationName] = filteredQuery.match(/(?<=query|mutation|subscription)\s*([^\s{]+)\s*\{/) || [];
      const [reqQuery] = filteredQuery.match(/{[\s\S]*$/) || [''];
      const isVariablesProvidedInTheQuery = !!filteredQuery.match(
        /^\s*(mutation|query)\s*[a-zA-Z0-9_]*\s*\([^)]+\)\s*\{/,
      );

      const res = await fetcher(url, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({
          operationName,
          query: !operationName && queryType === 'query' && !isVariablesProvidedInTheQuery ? reqQuery : filteredQuery,
          variables: variables ? JSON.parse(variables) : {},
        }),
      });
      console.log(res, 'res');
      dispatch(setResponse(res));
      return res;
    } catch (error) {
      toast.error(error as string);
    }
  };

  const sendQuery = () => {
    if (isValid) {
      executeQuery().then((data) => {
        const buffer = data ? Buffer.from(JSON.stringify(data?.data), 'utf-8').toString('base64') : '';
        // todo: add necessary parameters
        router.push(`${routes.graphql}/${buffer}`);
      });
    } else {
      toast.error(toastMessages.errorSendQueryGraphiQL);
    }
  };

  function a11yProps(index: number) {
    return {
      id: `qraphql-tab-${index}`,
      'aria-controls': `qraphql-tabpanel-${index}`,
    };
  }

  function edit(value: string) {
    dispatch(setQuery(value));
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<UrlGraphql>({
    resolver: yupResolver(urlValidationSchema),
  });

  return (
    <GraphiQLProvider fetcher={gqlFetcher}>
      <form onSubmit={handleSubmit(sendQuery)}>
        <div className="graphiql-container">
          <section className="px-3 pt-3">
            <UrlSection errors={errors} register={register} />
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={value} onChange={handleChange} aria-label="basic tabs example">
                <Tab label="Query" {...a11yProps(0)} />
                <Tab label="Headers" {...a11yProps(1)} />
                <Tab label="Documentation" {...a11yProps(2)} />
              </Tabs>
            </Box>
            <CustomTabPanel value={value} index={0}>
              <div>
                <div className="sticky top-0 flex justify-end gap-2">
                  <PrettifyButton />
                  <Button onClick={() => sendQuery()} type="submit" variant="contained">
                    Send
                  </Button>
                </div>
                <QueryEditor onEdit={edit} />
              </div>
              <Accordion className="sticky bottom-0 bg-gray-100 text-orange-600">
                <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls="panel1-content" id="panel1-header">
                  VARIABLES
                </AccordionSummary>
                <AccordionDetails>
                  <VariablesSection />
                </AccordionDetails>
              </Accordion>
            </CustomTabPanel>
            <CustomTabPanel value={value} index={1}>
              <GraphiqlHeader></GraphiqlHeader>
            </CustomTabPanel>
            <CustomTabPanel index={2} value={value}>
              <Documentation></Documentation>
            </CustomTabPanel>
          </section>
        </div>
      </form>
    </GraphiQLProvider>
  );
};

export default GraphiQLClient;
